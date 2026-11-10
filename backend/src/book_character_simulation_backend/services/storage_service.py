from __future__ import annotations

import io
import logging
import os
import shutil
import struct
import uuid
from pathlib import Path
from typing import Any, BinaryIO

from book_character_simulation_backend.config import Settings
from book_character_simulation_backend.errors import BadRequestError, ConfigurationError, StorageError

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

        is_production = getattr(settings, "app_env", "development") in ("production", "prod")
        if is_production and not self.is_cloud:
            raise ConfigurationError(
                "Cloudflare R2 is required in production environment (APP_ENV=production). "
                "Local ephemeral disk storage is prohibited."
            )

        if not self.is_cloud:
            self.local_dir.mkdir(parents=True, exist_ok=True)
            logger.info("StorageService running in local mode at: %s", self.local_dir)

    def generate_presigned_upload_url(
        self,
        key: str,
        content_type: str | None = None,
        expires_in: int = 3600,
    ) -> dict[str, Any]:
        """Generate a direct upload URL for client-side uploads."""
        clean_key = key.lstrip("/")

        if self.is_cloud and self._s3_client is not None:
            params: dict[str, Any] = {"Bucket": self.bucket_name, "Key": clean_key}
            if content_type:
                params["ContentType"] = content_type
            url = self._s3_client.generate_presigned_url(
                "put_object",
                Params=params,
                ExpiresIn=expires_in,
            )
            return {
                "upload_url": str(url),
                "method": "PUT",
                "key": clean_key,
                "storage_provider": "r2",
                "bucket": self.bucket_name,
                "headers": {"Content-Type": content_type} if content_type else {},
            }

        return {
            "upload_url": f"/api/v1/storage/upload/{clean_key}",
            "method": "POST",
            "key": clean_key,
            "storage_provider": "local",
            "bucket": "local",
            "headers": {"Content-Type": content_type} if content_type else {},
        }

    def generate_presigned_download_url(
        self,
        key: str,
        expires_in: int = 3600,
        response_content_type: str | None = None,
        response_content_disposition: str | None = None,
    ) -> dict[str, Any]:
        """Generate a presigned download URL for secure client-side streaming (EPUB, PDF, Audio)."""
        clean_key = key.lstrip("/")

        if self.is_cloud and self._s3_client is not None:
            params: dict[str, Any] = {"Bucket": self.bucket_name, "Key": clean_key}
            if response_content_type:
                params["ResponseContentType"] = response_content_type
            if response_content_disposition:
                params["ResponseContentDisposition"] = response_content_disposition
            try:
                url = self._s3_client.generate_presigned_url(
                    "get_object",
                    Params=params,
                    ExpiresIn=expires_in,
                )
                return {
                    "download_url": str(url),
                    "storage_provider": "r2",
                    "bucket": self.bucket_name,
                    "key": clean_key,
                    "expires_in": expires_in,
                }
            except Exception as exc:
                logger.warning("Could not generate presigned download URL for %s: %s", clean_key, exc)

        # Local mode fallback: returns local stream proxy URL
        return {
            "download_url": f"/api/v1/reader/storage-proxy/{clean_key}",
            "storage_provider": "local",
            "bucket": "local",
            "key": clean_key,
            "expires_in": expires_in,
        }

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

            try:
                self._s3_client.put_object(
                    Bucket=self.bucket_name,
                    Key=clean_key,
                    Body=payload_bytes,
                    **extra_args,
                )
                return clean_key
            except Exception as exc:
                if getattr(self.settings, "app_env", "development") in ("production", "prod"):
                    raise StorageError(
                        f"Cloudflare R2 upload failed for key '{clean_key}' on bucket '{self.bucket_name}': {exc}"
                    ) from exc
                logger.warning(
                    "Cloud storage put_object failed (%s on %s): %s. Falling back to local storage.",
                    clean_key,
                    self.bucket_name,
                    exc,
                )

        # Local filesystem mode (or fallback when cloud bucket is unreachable)
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
                logger.debug("Cloudflare R2 download_file not found or error (%s): %s. Checking local fallback.", clean_key, exc)

        # Local filesystem mode or fallback
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
            except Exception as exc:
                logger.warning("Failed to delete object from Cloudflare R2 (%s): %s", clean_key, exc)

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
                pass

        # Local filesystem mode
        target_path = self.local_dir / clean_key
        return target_path.is_file()

    def get_url(self, key: str, expires_in: int = 3600) -> str | None:
        """Generate a public URL or presigned download URL for an object."""
        clean_key = key.lstrip("/")

        if self.is_cloud:
            # If a public custom domain is configured on R2 (e.g. https://pub-xxxx.r2.dev or https://assets.lorely.app)
            if self.settings.r2_public_url:
                public_base = self.settings.r2_public_url.rstrip("/")
                return f"{public_base}/{clean_key}"

            if self._s3_client is not None:
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

    def validate_image_data(
        self, data: bytes, max_size_bytes: int = 10 * 1024 * 1024
    ) -> tuple[str, int, int]:
        """Validate image size, format (JPEG, PNG, WebP), and extract dimensions without external dependencies."""
        if not data:
            raise BadRequestError("Empty image file provided.")
        if len(data) > max_size_bytes:
            mb_limit = max_size_bytes // (1024 * 1024)
            raise BadRequestError(f"Avatar file size exceeds maximum limit of {mb_limit}MB.")

        parsed = self._parse_image_header(data)
        if not parsed:
            raise BadRequestError(
                "Invalid or unsupported image format. Supported formats are JPEG, PNG, and WebP."
            )

        content_type, width, height = parsed
        if width > 0 and height > 0:
            if width < 32 or height < 32:
                raise BadRequestError("Image dimensions too small. Minimum resolution is 32x32 pixels.")
            if width > 4096 or height > 4096:
                raise BadRequestError("Image dimensions too large. Maximum resolution is 4096x4096 pixels.")

        return content_type, width, height

    def _parse_image_header(self, data: bytes) -> tuple[str, int, int] | None:
        """Parse image binary header to extract (mime_type, width, height) safely."""
        if len(data) < 24:
            return None

        # 1. PNG
        if data.startswith(b"\x89PNG\r\n\x1a\n") and len(data) >= 24 and data[12:16] == b"IHDR":
            width, height = struct.unpack(">II", data[16:24])
            return "image/png", width, height

        # 2. JPEG
        if data.startswith(b"\xff\xd8"):
            idx = 2
            while idx < len(data) - 8:
                if data[idx] != 0xFF:
                    break
                marker = data[idx + 1]
                # SOF0, SOF1, SOF2 markers
                if marker in (0xC0, 0xC1, 0xC2, 0xC3):
                    height, width = struct.unpack(">HH", data[idx + 5 : idx + 9])
                    return "image/jpeg", width, height
                if marker in (0xD9, 0xDA):
                    break
                length = struct.unpack(">H", data[idx + 2 : idx + 4])[0]
                idx += 2 + length
            return "image/jpeg", 0, 0

        # 3. WebP (RIFF....WEBP)
        if data.startswith(b"RIFF") and len(data) >= 30 and data[8:12] == b"WEBP":
            subchunk = data[12:16]
            if subchunk == b"VP8 " and len(data) >= 30:
                width = struct.unpack("<H", data[26:28])[0] & 0x3FFF
                height = struct.unpack("<H", data[28:30])[0] & 0x3FFF
                return "image/webp", width, height
            elif subchunk == b"VP8L" and len(data) >= 25:
                b = struct.unpack("<I", data[21:25])[0]
                width = (b & 0x3FFF) + 1
                height = ((b >> 14) & 0x3FFF) + 1
                return "image/webp", width, height
            elif subchunk == b"VP8X" and len(data) >= 31:
                width = (struct.unpack("<I", data[24:28])[0] & 0xFFFFFF) + 1
                height = (struct.unpack("<I", data[27:31])[0] >> 8) + 1
                return "image/webp", width, height

        return None

    def upload_avatar(
        self,
        user_id: str,
        data: bytes,
        filename: str | None = None,
    ) -> dict[str, Any]:
        """Validate avatar image and store securely in Cloudflare R2 / storage."""
        content_type, width, height = self.validate_image_data(data)
        ext_map = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
        ext = ext_map.get(content_type, "jpg")
        unique_name = f"{uuid.uuid4().hex[:12]}.{ext}"
        storage_key = f"avatars/{user_id}/{unique_name}"

        self.upload_file(storage_key, data, content_type=content_type)
        avatar_url = self.get_url(storage_key)

        return {
            "storage_key": storage_key,
            "avatar_url": avatar_url,
            "content_type": content_type,
            "width": width,
            "height": height,
            "size_bytes": len(data),
        }
