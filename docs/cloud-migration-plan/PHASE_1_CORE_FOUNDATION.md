# Phase 1 — Core Foundation

## Goal

Dựng nền tảng vận hành cloud mode ổn định (auth context, workspace context, API client behavior, transform nền).

## Detailed steps

1. Chốt nguồn lấy cloud workspace context trong app state.
2. Chuẩn hóa lifecycle auth → hydrate user/workspace → enable cloud operations.
3. Chuẩn hóa API client namespaces và retry/timeout policy.
4. Chuẩn hóa token refresh flow và propagation vào Redux/storage.
5. Chuẩn hóa transform cơ bản cloud ↔ local cho collection/item/env.
6. Chuẩn hóa logging/telemetry cho mọi cloud call ở storage layer.

## Deliverables

- Foundation design spec
- API client behavior spec
- Auth/workspace context flow spec
- Observability baseline checklist

## Risks

- Workspace context chưa ổn định gây crash ở cloud mode
- Token lifecycle không nhất quán dẫn tới lỗi ngắt quãng

## Exit criteria

- Cloud mode có thể bootstrap ổn định sau login
- Các cloud call dùng chung error/timeout/retry policy
- Transform nền đủ để bước sang parity data operations
