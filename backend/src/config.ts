export const config = {
  port: parseInt(process.env.PORT ?? "3001", 10),
  allowedOrigins: (
    process.env.ALLOWED_ORIGINS ?? "http://localhost:5173"
  ).split(","),
};
