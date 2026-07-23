// Preload: print full stack for unhandled rejections
process.on("unhandledRejection", (reason) => {
  console.error("=== UNHANDLED REJECTION ===");
  console.error(reason);
  if (reason && reason.stack) console.error(reason.stack);
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  console.error("=== UNCAUGHT EXCEPTION ===");
  console.error(err);
  if (err && err.stack) console.error(err.stack);
  process.exit(1);
});
