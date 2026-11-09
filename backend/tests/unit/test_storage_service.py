from __future__ import annotations

import io
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from book_character_simulation_backend.config import Settings
from book_character_simulation_backend.services.storage_service import StorageService


@pytest.fixture
def local_storage(tmp_path: Path) -> StorageService:
    settings = Settings.from_env()
    # Create a local storage service pointing to a temporary test directory
    storage = StorageService(settings)
    storage.is_cloud = False
    storage.local_dir = tmp_path / "test_storage"
    storage.local_dir.mkdir(parents=True, exist_ok=True)
    return storage


def test_local_storage_upload_download(local_storage: StorageService):
    key = "books/b-123/original/novel.txt"
    content = "Chapter 1: Call me Ishmael."

    uploaded_key = local_storage.upload_file(key, content, content_type="text/plain")
    assert uploaded_key == key
    assert local_storage.file_exists(key) is True

    downloaded = local_storage.download_file(key)
    assert downloaded is not None
    assert downloaded.decode("utf-8") == content


def test_local_storage_upload_bytes_and_stream(local_storage: StorageService):
    # Test bytearray/bytes upload
    raw_bytes = b"\x89PNG\r\n\x1a\nFakeImageBytes"
    local_storage.upload_file("images/cover.png", raw_bytes, content_type="image/png")
    assert local_storage.download_file("images/cover.png") == raw_bytes

    # Test file-like / BytesIO stream
    stream = io.BytesIO(b"Streamed text content")
    local_storage.upload_file("docs/stream.txt", stream)
    assert local_storage.download_file("docs/stream.txt") == b"Streamed text content"


def test_local_storage_missing_file_returns_none(local_storage: StorageService):
    assert local_storage.download_file("nonexistent/file.txt") is None
    assert local_storage.file_exists("nonexistent/file.txt") is False


def test_local_storage_delete_file(local_storage: StorageService):
    key = "temp_uploads/job-1/draft.txt"
    local_storage.upload_file(key, "Temporary draft")
    assert local_storage.file_exists(key) is True

    result = local_storage.delete_file(key)
    assert result is True
    assert local_storage.file_exists(key) is False


def test_local_storage_delete_prefix(local_storage: StorageService):
    local_storage.upload_file("books/b-999/chapter1.txt", "Ch 1")
    local_storage.upload_file("books/b-999/chapter2.txt", "Ch 2")
    local_storage.upload_file("books/b-999/notes.txt", "Notes")
    local_storage.upload_file("books/b-other/data.txt", "Keep this")

    deleted_count = local_storage.delete_prefix("books/b-999/")
    assert deleted_count == 3
    assert local_storage.file_exists("books/b-999/chapter1.txt") is False
    assert local_storage.file_exists("books/b-other/data.txt") is True


def test_local_storage_get_url(local_storage: StorageService):
    url = local_storage.get_url("audio/session-1/msg-1.wav")
    assert url == "/api/v1/storage/audio/session-1/msg-1.wav"


def test_r2_cloud_initialization_and_operations(tmp_path: Path):
    mock_s3 = MagicMock()
    mock_s3.put_object.return_value = {"ETag": '"abcdef"'}
    mock_s3.get_object.return_value = {"Body": io.BytesIO(b"R2 downloaded payload")}
    mock_s3.head_object.return_value = {"ContentLength": 21}
    mock_s3.delete_object.return_value = {}
    mock_s3.generate_presigned_url.return_value = "https://cf-r2-presigned-url.com/download"

    paginator_mock = MagicMock()
    paginator_mock.paginate.return_value = [
        {"Contents": [{"Key": "books/b-cloud/ch1.txt"}, {"Key": "books/b-cloud/ch2.txt"}]}
    ]
    mock_s3.get_paginator.return_value = paginator_mock

    with patch("boto3.client", return_value=mock_s3) as mock_boto:
        base_settings = Settings.from_env()
        # Create settings with R2 config
        r2_settings = Settings(
            app_env=base_settings.app_env,
            debug=base_settings.debug,
            host=base_settings.host,
            port=base_settings.port,
            cors_origins=base_settings.cors_origins,
            chroma_db_path=base_settings.chroma_db_path,
            database_url=base_settings.database_url,
            database_connect_timeout=base_settings.database_connect_timeout,
            sqlalchemy_echo=base_settings.sqlalchemy_echo,
            auto_create_relational_schema=base_settings.auto_create_relational_schema,
            supabase_url=base_settings.supabase_url,
            supabase_anon_key=base_settings.supabase_anon_key,
            supabase_service_role_key=base_settings.supabase_service_role_key,
            supabase_jwt_secret=base_settings.supabase_jwt_secret,
            llm_provider=base_settings.llm_provider,
            llm_temperature=base_settings.llm_temperature,
            max_source_characters=base_settings.max_source_characters,
            openai_api_key=base_settings.openai_api_key,
            openai_model=base_settings.openai_model,
            gemini_api_key=base_settings.gemini_api_key,
            gemini_model=base_settings.gemini_model,
            admin_email=base_settings.admin_email,
            admin_password=base_settings.admin_password,
            r2_account_id="cf-account-xyz",
            r2_access_key_id="cf-access-key",
            r2_secret_access_key="cf-secret-key",
            r2_bucket_name="lorely-production-bucket",
            r2_public_url=None,
            storage_local_dir=tmp_path,
        )

        service = StorageService(r2_settings)
        assert service.is_cloud is True
        assert service.bucket_name == "lorely-production-bucket"
        mock_boto.assert_called_once()
        assert "cf-account-xyz.r2.cloudflarestorage.com" in mock_boto.call_args[1]["endpoint_url"]

        # Test upload
        uploaded = service.upload_file("books/b-cloud/text.txt", "Cloud content", content_type="text/plain")
        assert uploaded == "books/b-cloud/text.txt"
        mock_s3.put_object.assert_called_once()

        # Test download
        downloaded = service.download_file("books/b-cloud/text.txt")
        assert downloaded == b"R2 downloaded payload"
        mock_s3.get_object.assert_called_once()

        # Test file exists
        assert service.file_exists("books/b-cloud/text.txt") is True
        mock_s3.head_object.assert_called_once()

        # Test presigned URL
        url = service.get_url("books/b-cloud/text.txt", expires_in=1800)
        assert url == "https://cf-r2-presigned-url.com/download"

        # Test delete prefix
        deleted = service.delete_prefix("books/b-cloud/")
        assert deleted == 2
        mock_s3.delete_objects.assert_called_once()


def test_r2_public_url_format(tmp_path: Path):
    mock_s3 = MagicMock()
    with patch("boto3.client", return_value=mock_s3):
        base_settings = Settings.from_env()
        custom_domain_settings = Settings(
            app_env=base_settings.app_env,
            debug=base_settings.debug,
            host=base_settings.host,
            port=base_settings.port,
            cors_origins=base_settings.cors_origins,
            chroma_db_path=base_settings.chroma_db_path,
            database_url=base_settings.database_url,
            database_connect_timeout=base_settings.database_connect_timeout,
            sqlalchemy_echo=base_settings.sqlalchemy_echo,
            auto_create_relational_schema=base_settings.auto_create_relational_schema,
            supabase_url=base_settings.supabase_url,
            supabase_anon_key=base_settings.supabase_anon_key,
            supabase_service_role_key=base_settings.supabase_service_role_key,
            supabase_jwt_secret=base_settings.supabase_jwt_secret,
            llm_provider=base_settings.llm_provider,
            llm_temperature=base_settings.llm_temperature,
            max_source_characters=base_settings.max_source_characters,
            openai_api_key=base_settings.openai_api_key,
            openai_model=base_settings.openai_model,
            gemini_api_key=base_settings.gemini_api_key,
            gemini_model=base_settings.gemini_model,
            admin_email=base_settings.admin_email,
            admin_password=base_settings.admin_password,
            r2_account_id="cf-account-xyz",
            r2_access_key_id="cf-access-key",
            r2_secret_access_key="cf-secret-key",
            r2_bucket_name="lorely-production-bucket",
            r2_public_url="https://assets.lorely.app",
            storage_local_dir=tmp_path,
        )
        service = StorageService(custom_domain_settings)
        url = service.get_url("covers/book-1.jpg")
        assert url == "https://assets.lorely.app/covers/book-1.jpg"
