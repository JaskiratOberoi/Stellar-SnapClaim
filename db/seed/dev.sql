-- Dev seed: one company with categories and a spending policy.
-- Applied by the API when SNAPCLAIM_SEED_DEV=true and no company exists. Users are created in code (Bootstrap.cs).

INSERT INTO company(id, name, currency, timezone) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Stellar Infomatica', 'INR', 'Asia/Kolkata');

INSERT INTO category(company_id, code, name, icon, sort_order) VALUES
  ('11111111-1111-1111-1111-111111111111', 'travel',        'Travel & tickets',   'airplane',   10),
  ('11111111-1111-1111-1111-111111111111', 'fuel',          'Fuel & mileage',     'fuel',       20),
  ('11111111-1111-1111-1111-111111111111', 'meals',         'Meals',              'restaurant', 30),
  ('11111111-1111-1111-1111-111111111111', 'accommodation', 'Accommodation',      'hotel',      40),
  ('11111111-1111-1111-1111-111111111111', 'supplies',      'Office supplies',    'cart',       50),
  ('11111111-1111-1111-1111-111111111111', 'communication', 'Phone & internet',   'phone',      60),
  ('11111111-1111-1111-1111-111111111111', 'software',      'Software & subscriptions', 'laptop', 70),
  ('11111111-1111-1111-1111-111111111111', 'client',        'Client entertainment','people',    80),
  ('11111111-1111-1111-1111-111111111111', 'other',         'Other',              'receipt',    90);

-- Company-wide rule (category NULL) plus tighter caps on meals and client entertainment.
INSERT INTO policy_rule(company_id, category_id, max_per_claim, max_per_month, receipt_required_above, max_days_to_submit, notes)
SELECT '11111111-1111-1111-1111-111111111111'::uuid, NULL::uuid, 25000, 60000, 500, 30, 'Default company policy'
UNION ALL
SELECT '11111111-1111-1111-1111-111111111111'::uuid, id, 1500, 12000, 200, 30, 'Per-person meal cap' FROM category WHERE code = 'meals'
UNION ALL
SELECT '11111111-1111-1111-1111-111111111111'::uuid, id, 5000, 15000, 0, 30, 'Needs manager note above cap' FROM category WHERE code = 'client'
UNION ALL
SELECT '11111111-1111-1111-1111-111111111111'::uuid, id, 8000, 40000, 500, 30, 'Economy class only' FROM category WHERE code = 'travel';
