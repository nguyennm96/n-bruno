# MongoDB Schema Reference

> Tài liệu mô tả chi tiết toàn bộ schema MongoDB đang được sử dụng trong Bruno Cloud Server.
>
> **Database:** cấu hình qua env var `MONGODB_DATABASE` (mặc định `bruno`)  
> **Driver:** `mongodb` crate v3 (Rust)  
> **ID nội bộ:** `_id` — MongoDB `ObjectId`  
> **ID ngoài:** `uid` — 21-character nanoid (UUID v4 truncated), dùng trong API và frontend

---

## Tổng quan các Collections

| Collection | Mô tả | Soft Delete |
|---|---|---|
| `users` | Tài khoản người dùng | ❌ |
| `refresh_tokens` | JWT refresh token (TTL tự xóa) | ❌ |
| `workspaces` | Workspace nhóm làm việc | ❌ |
| `workspace_members` | Quan hệ user ↔ workspace + role | ❌ |
| `collections` | API collection | ✅ `deletedAt` |
| `items` | Folder và Request trong collection | ✅ `deletedAt` |
| `environments` | Biến môi trường (workspace hoặc collection) | ✅ `deletedAt` |
| `examples` | Response example của request | ✅ `deletedAt` |

---

## 1. `users`

Lưu thông tin tài khoản người dùng. Password không bao giờ trả về qua API.

### Schema

| Field | Kiểu (MongoDB) | Kiểu (Rust) | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `_id` | `ObjectId` | `Option<ObjectId>` | ✅ | Primary key — gán bởi MongoDB |
| `email` | `String` | `String` | ✅ | Email đăng nhập — **unique** |
| `password_hash` | `String` | `String` | ✅ | Argon2 hash của password — không bao giờ expose qua API |
| `name` | `String` | `String` | ✅ | Tên hiển thị |
| `created_at` | `Date` | `DateTime<Utc>` | ✅ | Thời điểm tạo tài khoản |
| `updated_at` | `Date` | `DateTime<Utc>` | ✅ | Thời điểm cập nhật gần nhất |

### Indexes

| Field | Loại | Ghi chú |
|---|---|---|
| `email` | Unique | Ngăn duplicate tài khoản |

### Ví dụ Document

```json
{
  "_id": { "$oid": "65f1a2b3c4d5e6f7a8b9c0d1" },
  "email": "daniel@usebruno.com",
  "password_hash": "$argon2id$v=19$m=65536,t=3,p=4$...",
  "name": "Daniel Nguyen",
  "created_at": { "$date": "2026-01-15T08:30:00.000Z" },
  "updated_at": { "$date": "2026-03-01T10:00:00.000Z" }
}
```

---

## 2. `refresh_tokens`

Lưu refresh token để cấp access token mới. MongoDB TTL index tự xóa token hết hạn.

### Schema

| Field | Kiểu (MongoDB) | Kiểu (Rust) | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `_id` | `ObjectId` | `Option<ObjectId>` | ✅ | Primary key |
| `user_id` | `ObjectId` | `ObjectId` | ✅ | Tham chiếu đến `users._id` |
| `token_hash` | `String` | `String` | ✅ | Bcrypt hash của token thực — không lưu raw token |
| `expires_at` | `Date` | `DateTime<Utc>` | ✅ | **TTL index** — MongoDB tự xóa document khi hết hạn |
| `created_at` | `Date` | `DateTime<Utc>` | ✅ | Thời điểm tạo token |

### Indexes

| Field | Loại | Ghi chú |
|---|---|---|
| `expires_at` | TTL (`expireAfterSeconds: 0`) | Tự động xóa document khi `expires_at` đã qua |
| `token_hash` | Regular | Tra cứu khi verify refresh token |
| `user_id` | Regular | Xóa tất cả token khi user logout |

### Ví dụ Document

```json
{
  "_id": { "$oid": "65f1a2b3c4d5e6f7a8b9c0d2" },
  "user_id": { "$oid": "65f1a2b3c4d5e6f7a8b9c0d1" },
  "token_hash": "$2b$12$hashed_refresh_token...",
  "expires_at": { "$date": "2026-04-07T05:00:00.000Z" },
  "created_at": { "$date": "2026-03-07T05:00:00.000Z" }
}
```

> **Lưu ý bảo mật:** Raw refresh token chỉ được trả về client một lần khi login/refresh. Server chỉ lưu hash.

---

## 3. `workspaces`

Không gian làm việc nhóm — chứa nhiều collections và environments.

### Schema

| Field | Kiểu (MongoDB) | Kiểu (Rust) | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `_id` | `ObjectId` | `Option<ObjectId>` | ✅ | Primary key nội bộ |
| `uid` | `String` | `String` | ✅ | **Unique** nanoid 21 ký tự — ID dùng trong API |
| `name` | `String` | `String` | ✅ | Tên workspace |
| `description` | `String` | `Option<String>` | ❌ | Mô tả workspace |
| `owner_id` | `ObjectId` | `ObjectId` | ✅ | Tham chiếu `users._id` — người tạo workspace |
| `created_at` | `Date` | `DateTime<Utc>` | ✅ | Thời điểm tạo |
| `updated_at` | `Date` | `DateTime<Utc>` | ✅ | Thời điểm cập nhật |

### Indexes

| Field | Loại | Ghi chú |
|---|---|---|
| `uid` | Unique | Tra cứu nhanh bằng external ID từ API |

### Ví dụ Document

```json
{
  "_id": { "$oid": "65f1a2b3c4d5e6f7a8b9c0d3" },
  "uid": "ws_abc123def456ghi",
  "name": "Bruno Internal APIs",
  "description": "Tập hợp các API nội bộ của Bruno Cloud",
  "owner_id": { "$oid": "65f1a2b3c4d5e6f7a8b9c0d1" },
  "created_at": { "$date": "2026-01-20T09:00:00.000Z" },
  "updated_at": { "$date": "2026-02-10T14:30:00.000Z" }
}
```

---

## 4. `workspace_members`

Bảng quan hệ giữa user và workspace, bao gồm role.

### Schema

| Field | Kiểu (MongoDB) | Kiểu (Rust) | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `_id` | `ObjectId` | `Option<ObjectId>` | ✅ | Primary key |
| `workspace_id` | `ObjectId` | `ObjectId` | ✅ | Tham chiếu `workspaces._id` |
| `user_id` | `ObjectId` | `ObjectId` | ✅ | Tham chiếu `users._id` |
| `role` | `String` (enum) | `WorkspaceRole` | ✅ | Quyền hạn — xem bảng Role bên dưới |
| `joined_at` | `Date` | `DateTime<Utc>` | ✅ | Thời điểm được thêm vào workspace |

### `role` enum

| Giá trị | Quyền hạn |
|---|---|
| `"owner"` | Toàn quyền — CRUD + quản lý thành viên + xóa workspace |
| `"editor"` | Tạo/sửa collection, item, environment — không thể xóa workspace |
| `"viewer"` | Chỉ đọc |

### Indexes

| Field | Loại | Ghi chú |
|---|---|---|
| `workspace_id` | Regular | Lấy tất cả thành viên của workspace |
| `user_id` | Regular | Lấy tất cả workspace mà user tham gia |

### Ví dụ Document

```json
{
  "_id": { "$oid": "65f1a2b3c4d5e6f7a8b9c0d4" },
  "workspace_id": { "$oid": "65f1a2b3c4d5e6f7a8b9c0d3" },
  "user_id": { "$oid": "65f1a2b3c4d5e6f7a8b9c0d1" },
  "role": "owner",
  "joined_at": { "$date": "2026-01-20T09:00:00.000Z" }
}
```

---

## 5. `collections`

API collection — tương ứng với một folder collection trong Bruno desktop.

### Schema

| Field | Kiểu (MongoDB) | Kiểu (Rust) | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `_id` | `ObjectId` | `Option<ObjectId>` | ✅ | Primary key nội bộ |
| `uid` | `String` | `String` | ✅ | **Unique** nanoid 21 ký tự |
| `name` | `String` | `String` | ✅ | Tên collection |
| `description` | `String` | `Option<String>` | ❌ | Mô tả collection |
| `workspaceUid` | `String` | `String` | ✅ | `uid` của workspace chứa collection này |
| `bruno_config` | `Object` | `Option<JsonValue>` | ❌ | Nội dung file `bruno.json` — cấu hình collection |
| `root` | `Object` | `Option<JsonValue>` | ❌ | Root-level settings (auth, headers, scripts mặc định) |
| `created_at` | `Date` | `DateTime<Utc>` | ✅ | Thời điểm tạo |
| `updated_at` | `Date` | `DateTime<Utc>` | ✅ | Thời điểm cập nhật |
| `deletedAt` | `Date` | `Option<DateTime<Utc>>` | ❌ | **Soft delete** — set khi xóa, `null` khi còn sống |
| `public_docs` | `Object` | `Option<PublicDocs>` | ❌ | Embedded — cấu hình publish docs công khai |

### Embedded: `public_docs`

| Field | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `enabled` | `Boolean` | ✅ | Docs có đang public không |
| `slug` | `String` | ✅ | URL slug — ví dụ `"my-api-v2"` → `/p/my-api-v2` |
| `published_at` | `Date` | ✅ | Thời điểm publish lần đầu |
| `visibility` | `Object` | ✅ | Kiểm soát quyền truy cập (xem bảng dưới) |
| `settings` | `Object` | ✅ | Tuỳ chỉnh giao diện docs |
| `analytics` | `Object` | ❌ | Thống kê lượt xem |

### Embedded: `public_docs.visibility` (tagged enum)

| `type` | Field bổ sung | Mô tả |
|---|---|---|
| `"public"` | — | Ai có link đều xem được |
| `"password"` | `hash: String` | Argon2 hash của password truy cập |
| `"workspaceMembers"` | — | Chỉ thành viên workspace |
| `"customList"` | `user_ids: [String]` | Danh sách user uid cụ thể |

### Embedded: `public_docs.settings`

| Field | Kiểu | Default | Mô tả |
|---|---|---|---|
| `show_examples` | `Boolean` | `true` | Hiển thị response examples |
| `show_auth` | `Boolean` | `true` | Hiển thị thông tin auth |
| `custom_css` | `String` | `null` | CSS tùy chỉnh giao diện docs |
| `custom_logo_url` | `String` | `null` | URL logo tùy chỉnh |

### Embedded: `public_docs.analytics`

| Field | Kiểu | Default | Mô tả |
|---|---|---|---|
| `views` | `Int32` | `0` | Tổng lượt xem |
| `unique_visitors` | `Int32` | `0` | Khách truy cập duy nhất (theo IP hash) |
| `last_viewed` | `Date` | `null` | Lần xem gần nhất |

### Indexes

| Field | Loại | Ghi chú |
|---|---|---|
| `uid` | Unique | Tra cứu bằng external ID |
| `workspaceUid` | Regular | Liệt kê collections theo workspace |
| `deletedAt` | Regular | Lọc soft-deleted documents |

### Ví dụ Document

```json
{
  "_id": { "$oid": "65f1a2b3c4d5e6f7a8b9c0d5" },
  "uid": "col_xyz789abc123def",
  "name": "User Management API",
  "description": "Các endpoint quản lý người dùng",
  "workspaceUid": "ws_abc123def456ghi",
  "bruno_config": {
    "version": "1",
    "name": "User Management API",
    "type": "collection",
    "ignore": ["node_modules", ".git"]
  },
  "root": {
    "request": {
      "auth": { "mode": "bearer" },
      "headers": [{ "name": "X-App-Version", "value": "2.0.0", "enabled": true }]
    }
  },
  "created_at": { "$date": "2026-02-01T10:00:00.000Z" },
  "updated_at": { "$date": "2026-03-05T08:00:00.000Z" },
  "deletedAt": null,
  "public_docs": {
    "enabled": true,
    "slug": "user-management-api",
    "published_at": { "$date": "2026-03-01T00:00:00.000Z" },
    "visibility": { "type": "public" },
    "settings": {
      "show_examples": true,
      "show_auth": false,
      "custom_css": null,
      "custom_logo_url": "https://cdn.usebruno.com/logo.png"
    },
    "analytics": {
      "views": 142,
      "unique_visitors": 89,
      "last_viewed": { "$date": "2026-03-07T04:00:00.000Z" }
    }
  }
}
```

---

## 6. `items`

Lưu cả Folder và Request trong một collection. Phân biệt bằng field `type`.

### Schema

| Field | Kiểu (MongoDB) | Kiểu (Rust) | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `_id` | `ObjectId` | `Option<ObjectId>` | ✅ | Primary key nội bộ |
| `uid` | `String` | `String` | ✅ | **Unique** nanoid 21 ký tự |
| `type` | `String` (enum) | `ItemType` | ✅ | `"folder"` hoặc `"request"` |
| `name` | `String` | `String` | ✅ | Tên item (tên folder hoặc tên request) |
| `collectionUid` | `String` | `String` | ✅ | `uid` của collection chứa item này |
| `parentUid` | `String` | `Option<String>` | ❌ | `uid` của folder cha — `null` nếu ở root collection |
| `seq` | `Double` | `f64` | ✅ | Thứ tự sắp xếp trong parent — dùng fractional index để reorder không cần update hàng loạt |
| `request` | `Object` | `Option<Request>` | ❌ | Chi tiết HTTP request — chỉ có khi `type = "request"` |
| `settings` | `Object` | `Option<Settings>` | ❌ | Cài đặt HTTP — chỉ có khi `type = "request"` |
| `filename` | `String` | `Option<String>` | ❌ | Tên file `.bru` tương ứng — ví dụ `"get-user.bru"` |
| `docs` | `String` | `Option<String>` | ❌ | Markdown documentation — dùng cho folder-level docs |
| `created_at` | `Date` | `DateTime<Utc>` | ✅ | Thời điểm tạo |
| `updated_at` | `Date` | `DateTime<Utc>` | ✅ | Thời điểm cập nhật |
| `deletedAt` | `Date` | `Option<DateTime<Utc>>` | ❌ | **Soft delete** |

### Embedded: `request` (chỉ khi `type = "request"`)

| Field | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `url` | `String` | ✅ | URL của request — hỗ trợ biến `{{variable}}` |
| `method` | `String` | ✅ | HTTP method: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS` |
| `headers` | `Array<KeyValue>` | ✅ | Danh sách headers |
| `params` | `Array<RequestParam>` | ✅ | Query params và path params |
| `auth` | `Object<Auth>` | ❌ | Cấu hình authentication |
| `body` | `Object<RequestBody>` | ✅ | Request body |
| `script` | `Object<Script>` | ❌ | Pre-request và post-response script (JavaScript) |
| `vars` | `Object<RequestVars>` | ❌ | Request/response variables |
| `assertions` | `Array<Assertion>` | ❌ | Declarative assertions cho test |
| `tests` | `String` | ❌ | JavaScript test code |
| `docs` | `String` | ❌ | Markdown documentation cho request này |

### Embedded: `request.headers` / `request.vars.req` / `request.vars.res` — `KeyValue`

| Field | Kiểu | Mô tả |
|---|---|---|
| `uid` | `String?` | nanoid của entry |
| `name` | `String?` | Tên key |
| `value` | `String?` | Giá trị |
| `description` | `String?` | Ghi chú |
| `enabled` | `Boolean` | Bật/tắt entry này |

### Embedded: `request.params` — `RequestParam`

| Field | Kiểu | Mô tả |
|---|---|---|
| `uid` | `String?` | nanoid |
| `name` | `String?` | Tên param |
| `value` | `String?` | Giá trị |
| `description` | `String?` | Ghi chú |
| `type` | `String` | `"query"` hoặc `"path"` |
| `enabled` | `Boolean` | Bật/tắt param |

### Embedded: `request.auth` — `Auth`

| Field | Kiểu | Mô tả |
|---|---|---|
| `mode` | `String` | `"inherit"`, `"none"`, `"basic"`, `"bearer"`, `"digest"`, `"oauth2"`, `"awsv4"`, `"wsse"`, `"apikey"` |
| `awsv4` | `Object?` | AWS Signature v4 config |
| `basic` | `Object?` | `{ username, password }` |
| `bearer` | `Object?` | `{ token }` |
| `digest` | `Object?` | `{ username, password }` |
| `oauth2` | `Object?` | OAuth2 config (grant type, client id/secret, scopes…) |
| `wsse` | `Object?` | WSSE config |
| `apikey` | `Object?` | `{ key, value, placement }` |

### Embedded: `request.body` — `RequestBody`

| Field | Kiểu | Mô tả |
|---|---|---|
| `mode` | `String` | `"none"`, `"json"`, `"text"`, `"xml"`, `"sparql"`, `"formUrlEncoded"`, `"multipartForm"`, `"graphql"`, `"file"` |
| `json` | `String?` | JSON body dạng string |
| `text` | `String?` | Plain text body |
| `xml` | `String?` | XML body |
| `sparql` | `String?` | SPARQL query |
| `formUrlEncoded` | `Array<KeyValue>?` | Form fields |
| `multipartForm` | `Object?` | Multipart form data |
| `graphql` | `Object?` | `{ query, variables }` |
| `file` | `Object?` | File upload config |

### Embedded: `request.script` — `Script`

| Field | Kiểu | Mô tả |
|---|---|---|
| `req` | `String?` | JavaScript chạy trước khi gửi request |
| `res` | `String?` | JavaScript chạy sau khi nhận response |

### Embedded: `request.assertions[]` — `Assertion`

| Field | Kiểu | Mô tả |
|---|---|---|
| `uid` | `String?` | nanoid |
| `name` | `String?` | Tên assertion (vd: `"res.status"`) |
| `operator` | `String?` | `"eq"`, `"neq"`, `"lt"`, `"lte"`, `"gt"`, `"gte"`, `"contains"`, `"notContains"` |
| `value` | `String?` | Giá trị kỳ vọng |
| `description` | `String?` | Ghi chú |
| `enabled` | `Boolean` | Bật/tắt assertion |

### Embedded: `settings` (chỉ khi `type = "request"`)

| Field | Kiểu | Default | Mô tả |
|---|---|---|---|
| `encodeUrl` | `Boolean?` | `true` | Encode URL tự động |
| `followRedirects` | `Boolean?` | `true` | Tự động follow redirect |
| `maxRedirects` | `Int32?` | `5` | Số redirect tối đa |
| `timeout` | `Int32?` | `null` | Timeout ms — `null` = không giới hạn |

### Indexes

| Field | Loại | Ghi chú |
|---|---|---|
| `uid` | Unique | Tra cứu bằng external ID |
| `collectionUid` | Regular | Lấy tất cả items của collection |
| `parentUid` | Regular | Lấy items con của folder |
| `deletedAt` | Regular | Lọc soft-deleted |

### Ví dụ Document — Folder

```json
{
  "_id": { "$oid": "65f1a2b3c4d5e6f7a8b9c0d6" },
  "uid": "fld_aabbccddeeaa12345",
  "type": "folder",
  "name": "Users",
  "collectionUid": "col_xyz789abc123def",
  "parentUid": null,
  "seq": 1.0,
  "request": null,
  "settings": null,
  "filename": null,
  "docs": "## Users\n\nCác endpoint quản lý user trong hệ thống.",
  "created_at": { "$date": "2026-02-01T10:05:00.000Z" },
  "updated_at": { "$date": "2026-02-01T10:05:00.000Z" },
  "deletedAt": null
}
```

### Ví dụ Document — Request

```json
{
  "_id": { "$oid": "65f1a2b3c4d5e6f7a8b9c0d7" },
  "uid": "req_11223344556677889",
  "type": "request",
  "name": "Get User",
  "collectionUid": "col_xyz789abc123def",
  "parentUid": "fld_aabbccddeeaa12345",
  "seq": 1.0,
  "filename": "get-user.bru",
  "docs": null,
  "request": {
    "url": "{{baseUrl}}/api/users/{{userId}}",
    "method": "GET",
    "headers": [
      { "uid": "hdr_001", "name": "Accept", "value": "application/json", "description": "", "enabled": true }
    ],
    "params": [
      { "uid": "pm_001", "name": "userId", "value": "123", "description": "User ID", "type": "path", "enabled": true }
    ],
    "auth": { "mode": "inherit" },
    "body": { "mode": "none" },
    "script": { "req": "", "res": "" },
    "vars": { "req": [], "res": [] },
    "assertions": [
      { "uid": "ast_001", "name": "res.status", "operator": "eq", "value": "200", "enabled": true }
    ],
    "tests": "expect(res.status).to.equal(200);",
    "docs": "Lấy thông tin chi tiết của một user theo ID."
  },
  "settings": {
    "encodeUrl": true,
    "followRedirects": true,
    "maxRedirects": 5,
    "timeout": null
  },
  "created_at": { "$date": "2026-02-01T10:10:00.000Z" },
  "updated_at": { "$date": "2026-03-01T09:00:00.000Z" },
  "deletedAt": null
}
```

---

## 7. `environments`

Biến môi trường. Có thể thuộc workspace (global) hoặc collection (local). Phân biệt bằng field nào được set: `workspaceUid` hay `collectionUid`.

### Schema

| Field | Kiểu (MongoDB) | Kiểu (Rust) | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `_id` | `ObjectId` | `Option<ObjectId>` | ✅ | Primary key nội bộ |
| `uid` | `String` | `String` | ✅ | **Unique** nanoid 21 ký tự |
| `name` | `String` | `String` | ✅ | Tên environment — ví dụ `"Production"`, `"Staging"` |
| `workspaceUid` | `String` | `Option<String>` | ❌* | Set nếu là workspace-level env |
| `collectionUid` | `String` | `Option<String>` | ❌* | Set nếu là collection-level env |
| `variables` | `Array<EnvVariable>` | `Vec<EnvVariable>` | ✅ | Danh sách biến |
| `color` | `String` | `Option<String>` | ❌ | Màu hiển thị — hex code, ví dụ `"#FF5733"` |
| `created_at` | `Date` | `DateTime<Utc>` | ✅ | Thời điểm tạo |
| `updated_at` | `Date` | `DateTime<Utc>` | ✅ | Thời điểm cập nhật |
| `deletedAt` | `Date` | `Option<DateTime<Utc>>` | ❌ | **Soft delete** |

> \* Đúng một trong hai field phải có giá trị. Không thể vừa là workspace-level vừa là collection-level.

### Embedded: `variables[]` — `EnvVariable`

| Field | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `uid` | `String?` | ❌ | nanoid của biến |
| `name` | `String` | ✅ | Tên biến — ví dụ `"baseUrl"` |
| `value` | `String` | ✅ | Giá trị — ví dụ `"https://api.example.com"` |
| `enabled` | `Boolean` | ✅ | Bật/tắt biến |
| `secret` | `Boolean?` | ❌ | Nếu `true` — giá trị ẩn trong UI, không sync lên cloud |

### Indexes

| Field | Loại | Ghi chú |
|---|---|---|
| `uid` | Unique | Tra cứu bằng external ID |
| `workspaceUid` | Regular | Lấy tất cả environments của workspace |
| `collectionUid` | Regular | Lấy tất cả environments của collection |
| `deletedAt` | Regular | Lọc soft-deleted |

### Ví dụ Document — Workspace-level

```json
{
  "_id": { "$oid": "65f1a2b3c4d5e6f7a8b9c0d8" },
  "uid": "env_production001",
  "name": "Production",
  "workspaceUid": "ws_abc123def456ghi",
  "collectionUid": null,
  "variables": [
    { "uid": "var_001", "name": "baseUrl", "value": "https://api.usebruno.com", "enabled": true, "secret": false },
    { "uid": "var_002", "name": "apiKey",  "value": "sk-prod-xxxxxx",           "enabled": true, "secret": true }
  ],
  "color": "#28A745",
  "created_at": { "$date": "2026-02-05T08:00:00.000Z" },
  "updated_at": { "$date": "2026-03-01T12:00:00.000Z" },
  "deletedAt": null
}
```

### Ví dụ Document — Collection-level

```json
{
  "_id": { "$oid": "65f1a2b3c4d5e6f7a8b9c0d9" },
  "uid": "env_staging_col001",
  "name": "Staging",
  "workspaceUid": null,
  "collectionUid": "col_xyz789abc123def",
  "variables": [
    { "uid": "var_010", "name": "baseUrl", "value": "https://staging.api.usebruno.com", "enabled": true }
  ],
  "color": "#FFC107",
  "created_at": { "$date": "2026-02-06T09:00:00.000Z" },
  "updated_at": { "$date": "2026-02-06T09:00:00.000Z" },
  "deletedAt": null
}
```

---

## 8. `examples`

Response example cho mỗi request — dùng để hiển thị docs và mock.

### Schema

| Field | Kiểu (MongoDB) | Kiểu (Rust) | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `_id` | `ObjectId` | `Option<ObjectId>` | ✅ | Primary key nội bộ |
| `uid` | `String` | `String` | ✅ | **Unique** nanoid — có thể do client hoặc server tạo |
| `name` | `String` | `String` | ✅ | Tên example — ví dụ `"Success 200"`, `"Not Found 404"` |
| `description` | `String` | `Option<String>` | ❌ | Mô tả thêm |
| `requestUid` | `String` | `String` | ✅ | `uid` của item request cha |
| `status_code` | `Int32` | `u16` | ✅ | HTTP status code — ví dụ `200`, `404`, `422` |
| `status_text` | `String` | `Option<String>` | ❌ | Status text — ví dụ `"OK"`, `"Not Found"` |
| `headers` | `Object` (BSON Document) | `Document` | ✅ | Response headers dạng key-value map |
| `body` | `String` | `Option<String>` | ❌ | Response body dạng string (JSON, XML, text...) |
| `requestSnapshot` | `Object` | `Option<JsonValue>` | ❌ | Snapshot của request lúc capture example (url, method, headers, body) |
| `responseTime` | `Int64` | `Option<i64>` | ❌ | Thời gian response tính bằng milliseconds |
| `responseSize` | `Int64` | `Option<i64>` | ❌ | Kích thước response tính bằng bytes |
| `created_at` | `Date` | `DateTime<Utc>` | ✅ | Thời điểm tạo |
| `updated_at` | `Date` | `DateTime<Utc>` | ✅ | Thời điểm cập nhật |
| `deletedAt` | `Date` | `Option<DateTime<Utc>>` | ❌ | **Soft delete** |

> **Lưu ý về list endpoint:** `GET /api/items/:id/examples` và `GET /api/collections/:id/examples` trả về `ExampleSummary` — **không bao gồm** `body` và `requestSnapshot` để giảm payload. Dùng `GET /api/examples/:id` để lấy đầy đủ.

### Indexes

| Field | Loại | Ghi chú |
|---|---|---|
| `uid` | Unique | Tra cứu bằng external ID |
| `requestUid` | Regular | Lấy tất cả examples của một request |
| `deletedAt` | Regular | Lọc soft-deleted |

### Ví dụ Document

```json
{
  "_id": { "$oid": "65f1a2b3c4d5e6f7a8b9c0da" },
  "uid": "exm_99887766554433221",
  "name": "Success - Get User",
  "description": "User tồn tại và đang active",
  "requestUid": "req_11223344556677889",
  "status_code": 200,
  "status_text": "OK",
  "headers": {
    "content-type": "application/json",
    "x-request-id": "abc-123"
  },
  "body": "{\"id\":\"123\",\"email\":\"daniel@usebruno.com\",\"name\":\"Daniel\"}",
  "requestSnapshot": {
    "url": "https://api.usebruno.com/api/users/123",
    "method": "GET",
    "headers": [{ "name": "Accept", "value": "application/json" }],
    "params": [],
    "body": null
  },
  "responseTime": 145,
  "responseSize": 1024,
  "created_at": { "$date": "2026-03-01T11:00:00.000Z" },
  "updated_at": { "$date": "2026-03-01T11:00:00.000Z" },
  "deletedAt": null
}
```

---

## Quan hệ giữa các Collections

```
users (1) ──────────────────── (N) refresh_tokens
  │                                   [user_id → users._id]
  │
  ├── (N) workspace_members ──── (N) workspaces
  │        [user_id → users._id]       │
  │        [workspace_id → ws._id]     │
  │                                    │
  │                          (N) collections
  │                               [workspaceUid → workspaces.uid]
  │                                    │
  │                          (N) environments (collection-level)
  │                               [collectionUid → collections.uid]
  │                                    │
  │                          (N) items (folder/request tree)
  │                               [collectionUid → collections.uid]
  │                               [parentUid → items.uid (self-ref)]
  │                                    │
  │                          (N) examples
  │                               [requestUid → items.uid]
  │
  └── (N) environments (workspace-level)
           [workspaceUid → workspaces.uid]
```

---

## Soft Delete

Các collections sau hỗ trợ soft delete — không xóa document khỏi MongoDB mà set `deletedAt`:

| Collection | Field | Behavior |
|---|---|---|
| `collections` | `deletedAt` | Query luôn filter `deletedAt: null` hoặc `$exists: false` |
| `items` | `deletedAt` | Xóa folder cascade soft-delete tất cả items con |
| `environments` | `deletedAt` | Query luôn filter `deletedAt: null` |
| `examples` | `deletedAt` | Query luôn filter `deletedAt: null` |

---

## Quy ước UID

| Loại | Thuật toán | Độ dài | Ví dụ |
|---|---|---|---|
| `users._id`, `workspaces._id`, … | MongoDB `ObjectId` | 12 bytes / 24 hex chars | `65f1a2b3c4d5e6f7a8b9c0d1` |
| `workspaces.uid`, `collections.uid`, `items.uid`, … | UUID v4 lấy 21 ký tự đầu (nanoid-compatible) | 21 chars | `ws_abc123def456ghi78` |

```rust
// Cách tạo uid trong code (models/item.rs)
pub fn generate_uid() -> String {
    uuid::Uuid::new_v4().simple().to_string()[..21].to_string()
}
```

---

## JWT Claims (không lưu trong MongoDB)

JWT access token chứa các claims sau (không persist — chỉ tồn tại trong token):

| Claim | Kiểu | Mô tả |
|---|---|---|
| `sub` | `String` | `users._id` dạng hex string — dùng để tra cứu user |
| `email` | `String` | Email — bản sao để tránh query DB |
| `name` | `String` | Tên hiển thị — bản sao |
| `exp` | `i64` | Unix timestamp hết hạn |
| `iat` | `i64` | Unix timestamp cấp phát |
