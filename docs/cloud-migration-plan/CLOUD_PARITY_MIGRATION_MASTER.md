# Cloud Parity Migration Master Plan

## 1) Objective

Xây dựng cloud version cho các tính năng hiện có của local mà không làm thay đổi hành vi local hiện tại.

- Local mode: tiếp tục chạy như hiện tại (filesystem + IPC)
- Cloud mode: cùng behavior chức năng, khác backend (bruno-server + API)
- Routing mode: do `StorageManager` quyết định theo trạng thái auth

## 2) Scope

### In scope

- Parity theo toàn bộ operation exposed qua `StorageManager`
- Chuẩn hóa data contract local/cloud để UI không phải branch logic phức tạp
- Thiết kế rollout có feature flag và rollback an toàn

### Out of scope (giai đoạn này)

- Refactor lớn kiến trúc UI không phục vụ parity
- Thay đổi UX hiện hữu của local nếu không bắt buộc
- Tối ưu hiệu năng nâng cao trước khi đạt parity cơ bản

## 3) Non-negotiable principles

1. Không làm regression local mode.
2. Không đổi public interface của `StorageManager` khi chưa có migration note.
3. API cloud phải có contract rõ ràng trước khi triển khai.
4. Mỗi phase có acceptance criteria và review gate riêng.

## 4) Phase roadmap

- Phase 0: Scope & Contracts
- Phase 1: Core Foundation
- Phase 2: Core Data Parity
- Phase 3: Workspace Parity
- Phase 4: Advanced Parity
- Phase 5: Validation & Rollout

Chi tiết nằm ở từng tài liệu phase trong cùng thư mục.

## 5) Dependency map

- App storage layer: `packages/bruno-app/src/utils/storage/*`
- API client layer: `packages/bruno-app/src/services/brunoApi.js`
- Backend routes/handlers: `packages/bruno-server/src/router.rs`, `packages/bruno-server/src/handlers/*`
- Redux/Auth context: `packages/bruno-app/src/providers/ReduxStore/slices/*`

## 6) Governance & review gates

- Gate A: Approve Phase 0 trước khi chốt contracts
- Gate B: Approve Phase 1 trước khi làm parity operations
- Gate C: Approve Phase 2 + 3 trước khi mở advanced features
- Gate D: Approve Phase 5 trước rollout production

## 7) Deliverables overview

- Bộ tài liệu phase (0–5)
- Capability matrix local ↔ cloud
- Acceptance checklist từng phase
- Rollout + rollback playbook

## 8) Success criteria

- Người dùng login có thể dùng cloud version cho tính năng tương đương local
- Người dùng chưa login tiếp tục dùng local như cũ, không thay đổi hành vi
- Không có regressions nghiêm trọng ở luồng collection/workspace/env/request
