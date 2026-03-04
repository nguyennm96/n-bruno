# Phase 4 — Advanced Parity

## Goal

Tất cả các tính năng nâng cao đều là **local-mode only** — không cần implement thêm cho cloud mode.

## Out of scope (local-mode only)

| Feature | Reason |
|---------|--------|
| gRPC | Phụ thuộc `grpc-js` runtime và protobuf binary |
| Git clone/sync | Phụ thuộc filesystem và `git` binary |
| Collection Runner | Phụ thuộc filesystem execution context |
| Security / Credentials | SSL certs, client certs, proxy — filesystem-based |
| Dotenv | Phụ thuộc filesystem watcher (`chokidar`) |
| OAuth2 | Token cache và Authorization Code flow phụ thuộc Electron IPC |

## Kết luận

Phase 4 không có deliverable cho cloud mode. Cloud mode dùng **Environments** thay thế cho Dotenv và OAuth2 manual token nếu cần.

Chuyển sang Phase 5 (nếu có) hoặc đánh dấu cloud migration hoàn tất.
