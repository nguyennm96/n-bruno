# Phase 4 — Advanced Parity

## Goal

Lấp đầy parity cho các nhóm nâng cao: OAuth2, gRPC, Git, Dotenv, runner và các luồng liên quan.

## Detailed steps

1. Chốt phạm vi OAuth2 cloud (authorize, refresh, in-progress, cancel, cache).
2. Chốt gRPC parity (reflection, command generation, runtime dependencies).
3. Chốt Git parity (clone/scan/import workflow boundaries).
4. Chốt Dotenv parity ở cả collection/workspace context.
5. Chốt runner behavior parity ở collection/folder execution.
6. Chốt security/compliance checklist cho credentials & secrets.

## Deliverables

- Advanced features contract set
- Security handling plan for credentials/secrets
- Operational constraints for gRPC/Git runner

## Risks

- Lệch behavior với local tooling phụ thuộc host machine
- Rủi ro bảo mật với token/secret handling

## Exit criteria

- Các nhóm advanced có contract và acceptance criteria rõ ràng
- Có policy bảo mật được duyệt trước khi triển khai
