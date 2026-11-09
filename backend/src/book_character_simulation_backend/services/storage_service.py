from __future__ import annotations

import io
import logging
import os
import shutil
from pathlib import Path
from typing import BinaryIO

from book_character_simulation_backend.config import Settings

logger = logging.getLogger(__name__)


class StorageService:
    """Object storage service supporting Cloudflare R2 (S3-compatible) with seamless local filesystem fallback.

    When Cloudflare R2 credentials (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME)
    are provided in .env, StorageService uploads and serves files directly to/from Cloudflare R2 with
    zero egress fees.

    When R2 credentials are not set (e.g. local development, testing, CI), StorageService automatically
    and gracefully falls back to local disk storage in `backend/storage/`, ensuring zero setup friction
    and zero test breakage.
    """

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._s3_client = None
        self.is_cloud = False
        self.bucket_name = "local"
        self.local_dir = settings.storage_local_dir or (
            Path(__file__).resolve().parents[3] / "storage"
        )

        has_r2_config = bool(
            settings.r2_account_id
            and settings.r2_access_key_id
            and settings.r2_secret_access_key
        )

        if has_r2_config:
            try:
                import boto3
                from botocore.config import Config

                account_id = settings.r2_account_id.strip()
                endpoint_url = f"https://{account_id}.r2.cloudflarestorage.com"
                self._s3_client = boto3.client(
                    "s3",
                    endpoint_url=endpoint_url,
                    aws_access_key_id=settings.r2_access_key_id.strip(),
                    aws_secret_access_key=settings.r2_secret_access_key.strip(),
                    region_name="auto",
                    config=Config(
                        signature_version="s3v4",
                        retries={"max_attempts": 3, "mode": "standard"},
                    ),
                )
                self.bucket_name = settings.r2_bucket_name or "lorely-books"
                self.is_cloud = True
                logger.info(
                    "StorageService initialized with Cloudflare R2 bucket: %s",
                    self.bucket_name,
                )
            except Exception as exc:  # pragma: no cover
                logger.warning(
                    "Could not initialize Cloudflare R2 client (%s). Falling back to local storage.",
                    exc,
                )
                self.is_cloud = False
                self.bucket_name = "local"

        if not self.is_cloud:
            self.local_dir.mkdir(parents=True, exist_ok=True)
            logger.info("StorageService running in local mode at: %s", self.local_dir)

    def upload_file(
        self,
        key: str,
        data: bytes | str | BinaryIO,
        content_type: str | None = None,
        metadata: dict[str, str] | None = None,
    ) -> str:
        """Upload raw binary or text data to object storage under the given key."""
        clean_key = key.lstrip("/")

        if isinstance(data, str):
            payload_bytes = data.encode("utf-8")
        elif isinstance(data, (bytes, bytearray)):
            payload_bytes = bytes(data)
        elif hasattr(data, "read"):
            payload_bytes = data.read()
            if isinstance(payload_bytes, str):
                payload_bytes = payload_bytes.encode("utf-8")
        else:
            raise TypeError(f"Unsupported data type for upload: {type(data)}")

        if self.is_cloud and self._s3_client is not None:
            extra_args: dict[str, object] = {}
            if content_type:
                extra_args["ContentType"] = content_type
            if metadata:
                extra_args["Metadata"] = {k: str(v) for k, v in metadata.items()}

            self._s3_client.put_object(
                Bucket=self.bucket_name,
                Key=clean_key,
                Body=payload_bytes,
                **extra_args,
            )
            return clean_key

        # Local filesystem mode
        target_path = self.local_dir / clean_key
        target_path.parent.mkdir(parents=True, exist_ok=True)
        target_path.write_bytes(payload_bytes)
        return clean_key

    def download_file(self, key: str) -> bytes | None:
        """Download file content as bytes. Returns None if file does not exist."""
        clean_key = key.lstrip("/")

        if self.is_cloud and self._s3_client is not None:
            try:
                response = self._s3_client.get_object(
                    Bucket=self.bucket_name, Key=clean_key
                )
                return response["Body"].read()
            except Exception as exc:
                logger.debug("Cloudflare R2 download_file not found or error (%s): %s", clean_key, exc)
                return None

        # Local filesystem mode
        target_path = self.local_dir / clean_key
        if not target_path.is_file():
            return None
        return target_path.read_bytes()

    def delete_file(self, key: str) -> bool:
        """Delete an object by key."""
        clean_key = key.lstrip("/")

        if self.is_cloud and self._s3_client is not None:
            try:
                self._s3_client.delete_object(Bucket=self.bucket_name, Key=clean_key)
                return True
            except Exception as exc:
                logger.warning("Failed to delete object from Cloudflare R2 (%s): %s", clean_key, exc)
                return False

        # Local filesystem mode
        target_path = self.local_dir / clean_key
        if target_path.is_file():
            try:
                target_path.unlink()
                return True
            except OSError:
                return False
        return True

    def file_exists(self, key: str) -> bool:
        """Check whether an object exists."""
        clean_key = key.lstrip("/")

        if self.is_cloud and self._s3_client is not None:
            try:
                self._s3_client.head_object(Bucket=self.bucket_name, Key=clean_key)
                return True
            except Exception:
                return False

        # Local filesystem mode
        target_path = self.local_dir / clean_key
        return target_path.is_file()

    def get_url(self, key: str, expires_in: int = 3600) -> str | None:
        """Generate a public URL or presigned download URL for an object."""
        clean_key = key.lstrip("/")

        # If a public custom domain is configured on R2 (e.g. https://pub-xxxx.r2.dev or https://assets.lorely.app)
        if self.settings.r2_public_url:
            public_base = self.settings.r2_public_url.rstrip("/")
            return f"{public_base}/{clean_key}"

        if self.is_cloud and self._s3_client is not None:
            try:
                url = self._s3_client.generate_presigned_url(
                    "get_object",
                    Params={"Bucket": self.bucket_name, "Key": clean_key},
                    ExpiresIn=expires_in,
                )
                return str(url)
            except Exception as exc:
                logger.warning("Could not generate presigned URL for %s: %s", clean_key, exc)
                return None

        # Local mode: returns API endpoint reference or file path
        return f"/api/v1/storage/{clean_key}"

    def delete_prefix(self, prefix: str) -> int:
        """Delete all objects sharing a prefix (e.g. 'books/{book_id}/')."""
        clean_prefix = prefix.lstrip("/")
        count = 0

        if self.is_cloud and self._s3_client is not None:
            try:
                paginator = self._s3_client.get_paginator("list_objects_v2")
                for page in paginator.paginate(Bucket=self.bucket_name, Prefix=clean_prefix):
                    objects = page.get("Contents", [])
                    if objects:
                        delete_payload = {"Objects": [{"Key": obj["Key"]} for obj in objects]}
                        self._s3_client.delete_objects(
                            Bucket=self.bucket_name, Delete=delete_payload
                        )
                        count += len(objects)
                return count
            except Exception as exc:
                logger.warning("Error deleting prefix %s in Cloudflare R2: %s", clean_prefix, exc)
                return count

        # Local mode
        target_dir = self.local_dir / clean_prefix
        if target_dir.is_dir():
            # Count files
            for p in target_dir.rglob("*"):
                if p.is_file():
                    count += 1
            shutil.rmtree(target_dir, ignore_errors=True)
        elif target_dir.is_file():
            target_dir.unlink(missing_ok=True)
            count = 1

        return count
