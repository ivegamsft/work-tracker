process.env.NODE_ENV = "test";
process.env.PORT ??= "3001";
process.env.JWT_SECRET ??= "test-only-secret";
process.env.JWT_EXPIRES_IN ??= "1h";
process.env.JWT_REFRESH_EXPIRES_IN ??= "7d";
process.env.LOG_LEVEL ??= "error";
process.env.DOCUMENT_PROCESSOR ??= "aws-textract";
process.env.TZ ??= "UTC";
