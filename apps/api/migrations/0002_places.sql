-- Địa điểm trên bản đồ: mộ phần, nơi sinh, nơi ở, nhà thờ họ, nguyên quán.
-- person_id NULL = địa điểm chung của dòng họ.

CREATE TABLE places (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id  uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  person_id  uuid,
  kind       text NOT NULL CHECK (kind IN ('burial','reburial','cenotaph','birth','residence','ancestral_hall','origin')),
  name       text NOT NULL,
  note       text,
  lat        double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng        double precision NOT NULL CHECK (lng BETWEEN -180 AND 180),
  -- 'coarse' = đã làm tròn (~10 km) vì thuộc người còn sống/chưa rõ
  precision  text NOT NULL CHECK (precision IN ('exact','coarse')),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (family_id, person_id) REFERENCES persons(family_id, id) ON DELETE CASCADE,
  CHECK ((person_id IS NULL) = (kind IN ('ancestral_hall','origin')))
);
CREATE INDEX places_family ON places(family_id);
CREATE INDEX places_person ON places(person_id);
