# Phase 5 — Validation & Rollout

## Goal

Đảm bảo migration an toàn qua kiểm thử, canary rollout, quan sát vận hành, và cơ chế rollback.

## Detailed steps

1. Thiết kế test pyramid cho migration (contract/integration/e2e/parity).
2. Xây acceptance suite theo operation critical path.
3. Chốt observability: metrics, traces, error dashboard theo operation.
4. Chốt feature flag strategy theo nhóm capability.
5. Chốt rollout strategy: internal → canary → wider rollout.
6. Chốt rollback playbook cho từng nhóm feature cloud.
7. Chốt post-release verification và bug triage SLA.

## Deliverables

- Validation checklist hoàn chỉnh
- Rollout/rollback playbook
- Release gate criteria
- Post-release monitoring checklist

## Risks

- Thiếu telemetry khiến khó khoanh vùng lỗi production
- Rollback không tách theo capability gây ảnh hưởng rộng

## Exit criteria

- Đạt đầy đủ release gates
- Canary đạt SLO đã định
- Có khả năng rollback nhanh theo capability group
