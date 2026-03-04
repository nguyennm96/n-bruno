# Phase 0 — Scope & Contracts

## Goal

Chốt phạm vi migration và contract chuẩn giữa app và server để các phase sau triển khai không bị đổi hướng.

## Detailed steps

1. Chốt danh mục operation từ `StorageManager` làm nguồn sự thật (single source of truth).
2. Lập capability matrix: mỗi operation có local impl, cloud impl, endpoint tương ứng, trạng thái.
3. Chốt định danh và mapping dữ liệu (`uid`, `pathname`, `workspace id`, `collection id`).
4. Chốt error contract thống nhất (shape, code, message, retryability).
5. Chốt mode contract: anonymous/local và authenticated/cloud, bao gồm chuyển mode.
6. Chốt quy tắc tương thích ngược cho UI selectors/state.

## Deliverables

- Capability matrix v1
- API contract draft v1
- Data mapping spec v1
- Error taxonomy v1

## Risks

- Trùng/thiếu operation do inventory chưa đầy đủ
- Mismatch schema giữa local và cloud

## Exit criteria

- Matrix đã sign-off
- Contract và naming đã thống nhất cho Phase 1
- Không còn ambiguity về source of truth cho workspace context
