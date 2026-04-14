class AppError(Exception):
    status_code = 500

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class BadRequestError(AppError):
    status_code = 400


class UnauthorizedError(AppError):
    status_code = 401


class NotFoundError(AppError):
    status_code = 404


class ConfigurationError(AppError):
    status_code = 500


class UpstreamServiceError(AppError):
    status_code = 502


class UpstreamRateLimitError(AppError):
    status_code = 429
