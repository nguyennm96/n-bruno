# Phase 3 — Workspace Parity

## Goal

Migrate toàn bộ nhóm tính năng quản lý workspace từ local sang cloud version (không bỏ local).

## Detailed steps

1. Chuẩn hóa mô hình workspace cloud (lifecycle create/open/close/rename/list).
2. Chốt semantics cho workspace collections management (add/remove/reorder/load).
3. Chốt workspace environments/global environments parity.
4. Chốt workspace docs và metadata handling.
5. Chốt API specs trong ngữ cảnh workspace cloud.
6. Chốt watcher tương đương cho cloud (event feed/polling strategy).
7. Chốt import/export workspace behavior trên cloud.

## Deliverables

- Workspace lifecycle spec
- Workspace collections/environment/docs spec
- Cloud watcher equivalence strategy
- Workspace import/export contract

## Risks

- Khác biệt bản chất FS-local vs server-cloud gây lệch UX
- Thiếu strategy đồng bộ khi nhiều client cùng thao tác workspace

## Exit criteria

- Toàn bộ workspace feature có định nghĩa cloud behavior rõ ràng
- Có conflict handling policy cho multi-client edits
