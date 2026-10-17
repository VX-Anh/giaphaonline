-- Schema MVP slice: tài khoản, dòng họ, quyền, người, tên, quan hệ, hôn phối, lịch sử thay đổi.
-- Xem docs/ke-hoach-xay-dung-gia-pha-online.md mục 5.

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  full_name     text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE families (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  surname           text NOT NULL,
  origin_place      text,
  description       text,
  founder_person_id uuid,
  created_by        uuid NOT NULL REFERENCES users(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE family_roles (
  family_id  uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('owner','co_admin','editor','branch_editor','member','viewer')),
  granted_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (family_id, user_id)
);

CREATE TABLE persons (
  id                  uuid NOT NULL DEFAULT gen_random_uuid(),
  family_id           uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  gender              text NOT NULL CHECK (gender IN ('male','female','unknown')),
  living_status       text NOT NULL CHECK (living_status IN ('alive','deceased','unknown')),
  -- "chưa xác minh căn cứ" cho người còn sống/chưa rõ được nhập hộ (mục 4.2)
  basis_status        text NOT NULL CHECK (basis_status IN ('verified','unverified','not_required')),
  generation_recorded integer CHECK (generation_recorded > 0),
  sibling_order       integer CHECK (sibling_order > 0),
  sibling_order_note  text CHECK (sibling_order_note IN ('unknown','twin')),
  is_anonymous        boolean NOT NULL DEFAULT false,
  birth_date          jsonb,
  death_date          jsonb,
  biography           text,
  created_by          uuid NOT NULL REFERENCES users(id),
  version             integer NOT NULL DEFAULT 1,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (family_id, id),
  CHECK (basis_status <> 'not_required' OR living_status = 'deceased')
);

ALTER TABLE families
  ADD CONSTRAINT families_founder_fk
  FOREIGN KEY (id, founder_person_id) REFERENCES persons(family_id, id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE person_names (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id   uuid NOT NULL,
  person_id   uuid NOT NULL,
  type        text NOT NULL CHECK (type IN ('birth','taboo','courtesy','pen','posthumous','other')),
  value_vi    text NOT NULL,
  value_han_nom text,
  is_primary  boolean NOT NULL DEFAULT false,
  FOREIGN KEY (family_id, person_id) REFERENCES persons(family_id, id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX person_names_one_primary ON person_names(person_id) WHERE is_primary;

-- Nguồn sự thật duy nhất cho quan hệ cha mẹ - con (mục 5.2)
CREATE TABLE parent_child (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id  uuid NOT NULL,
  parent_id  uuid NOT NULL,
  child_id   uuid NOT NULL,
  type       text NOT NULL CHECK (type IN ('biological','adoptive','heir_adoption','unknown')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_id, child_id),
  CHECK (parent_id <> child_id),
  FOREIGN KEY (family_id, parent_id) REFERENCES persons(family_id, id) ON DELETE CASCADE,
  FOREIGN KEY (family_id, child_id)  REFERENCES persons(family_id, id) ON DELETE CASCADE
);
CREATE INDEX parent_child_child ON parent_child(child_id);

CREATE TABLE unions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id   uuid NOT NULL,
  partner1_id uuid NOT NULL,
  partner2_id uuid NOT NULL,
  union_order integer,
  union_label text,
  start_date  jsonb,
  end_date    jsonb,
  end_reason  text CHECK (end_reason IN ('divorce','widowed')),
  CHECK (partner1_id <> partner2_id),
  FOREIGN KEY (family_id, partner1_id) REFERENCES persons(family_id, id) ON DELETE CASCADE,
  FOREIGN KEY (family_id, partner2_id) REFERENCES persons(family_id, id) ON DELETE CASCADE
);
CREATE INDEX unions_p1 ON unions(partner1_id);
CREATE INDEX unions_p2 ON unions(partner2_id);

-- Lịch sử thay đổi theo giao dịch (mục 2.1(9))
CREATE TABLE change_sets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id   uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES users(id),
  summary     text NOT NULL,
  status      text NOT NULL DEFAULT 'applied' CHECK (status IN ('applied','reverted')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE change_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  change_set_id uuid NOT NULL REFERENCES change_sets(id) ON DELETE CASCADE,
  target_table  text NOT NULL,
  target_id     uuid NOT NULL,
  before        jsonb,
  after         jsonb
);

-- Danh sách xóa theo yêu cầu chủ thể dữ liệu (mục 4.2)
CREATE TABLE erasure_registry (
  family_id   uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  target_type text NOT NULL,
  target_id   uuid NOT NULL,
  executed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (target_type, target_id)
);
