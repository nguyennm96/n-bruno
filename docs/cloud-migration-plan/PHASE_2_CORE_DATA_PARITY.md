# Phase 2 — Core Data Parity

## Goal

Đạt parity cho nhóm thao tác dữ liệu lõi: collections, items/requests/folders, environments, config/security.

## Detailed steps

1. Lập danh sách operation ưu tiên cao theo tần suất sử dụng thực tế.
2. Chốt endpoint contract cho từng operation CRUD + batch operations.
3. Thiết kế parity cho tree semantics (parent-child, move, resequence, clone).
4. Chốt semantics load/save request (bao gồm large request path nếu có).
5. Chốt môi trường (environment) scope và quy tắc đọc/ghi nhất quán.
6. Chốt cấu hình collection root, bruno config, security config.
7. Chốt error handling cho partial failure ở batch/move/resequence.

## Deliverables

- Core operations parity matrix v2
- Endpoint mapping spec v2
- Batch operations behavior spec
- Environment scope decision record

## Risks

- Mismatch tree ordering giữa local và cloud
- Batch semantics không đồng nhất làm lệch state UI

## Exit criteria

- Nhóm core data operation có cloud plan hoàn chỉnh, không mơ hồ endpoint
- Có acceptance checklist cho từng operation trước khi code
