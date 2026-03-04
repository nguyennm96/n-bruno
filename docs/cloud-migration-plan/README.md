# Cloud Migration Plan (Local → Cloud Parity)

Tài liệu này là điểm vào chính cho kế hoạch migrate tính năng từ local sang cloud, theo hướng:

- Giữ nguyên toàn bộ trải nghiệm local hiện có
- Bổ sung cloud version cho cùng tính năng khi user đã login
- Triển khai theo phase, review trước mỗi phase, chưa triển khai code nếu chưa duyệt

## Navigation

- Master plan: [`CLOUD_PARITY_MIGRATION_MASTER.md`](./CLOUD_PARITY_MIGRATION_MASTER.md)
- Phase 0: [`PHASE_0_SCOPE_AND_CONTRACTS.md`](./PHASE_0_SCOPE_AND_CONTRACTS.md)
- Phase 1: [`PHASE_1_CORE_FOUNDATION.md`](./PHASE_1_CORE_FOUNDATION.md)
- Phase 2: [`PHASE_2_CORE_DATA_PARITY.md`](./PHASE_2_CORE_DATA_PARITY.md)
- Phase 3: [`PHASE_3_WORKSPACE_PARITY.md`](./PHASE_3_WORKSPACE_PARITY.md)
- Phase 4: [`PHASE_4_ADVANCED_PARITY.md`](./PHASE_4_ADVANCED_PARITY.md)
- Phase 5: [`PHASE_5_VALIDATION_AND_ROLLOUT.md`](./PHASE_5_VALIDATION_AND_ROLLOUT.md)

## Review workflow

1. Review và approve `Master` để chốt hướng đi.
2. Review từng phase theo thứ tự `0 → 5`.
3. Sau khi approve một phase, mới tạo tài liệu chi tiết implementation cho phase đó.
4. Chỉ bắt đầu code sau khi bạn xác nhận phase implementation doc.
