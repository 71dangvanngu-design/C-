-- DIGITAL KNOWLEDGE HUB: Initial Curriculum & Layout Seed SQL
-- Safe to run multiple times (idempotent ON CONFLICT DO NOTHING).
-- NOTE: Does NOT create ADMIN credentials in SQL; ADMIN is initialized exclusively
-- via backend Supabase Admin API using SUPABASE_SERVICE_ROLE_KEY.

-- 1. Categories
insert into public.categories (id, name, slug, description)
values
  ('11111111-1111-4111-8111-111111111101', 'Systems & C++', 'systems-cpp', 'Memory layout, pointers, deterministic containers, and systems performance.'),
  ('11111111-1111-4111-8111-111111111102', 'Algorithms & Graphs', 'algorithms-graphs', 'Binary search, graph traversal, and asymptotic complexity analysis.'),
  ('11111111-1111-4111-8111-111111111103', 'Security & Architecture', 'security-architecture', 'Zero-trust access control, cryptographic hashing, and Row-Level Security.')
on conflict (slug) do nothing;

-- 2. Published Curriculum Lessons
insert into public.lessons (id, title, slug, summary, content, cpp_starter, category_id, level, read_minutes, image_url, status)
values
  (
    '22222222-2222-4222-8222-222222222201',
    'Contiguous Memory & Vector Allocation in Modern C++',
    'contiguous-memory-vector-allocation',
    'Explore how stack frames, heap buffers, and std::vector stride alignment affect CPU cache locality.',
    E'Modern processors fetch memory in 64-byte cache lines rather than isolated bytes. When elements live contiguously inside std::vector, sequential iteration hits L1 cache predictably.\n\nKey Architectural Principles:\n1. Stack frames allocate fixed-size primitives in O(1) via stack pointer decrement.\n2. Heap buffers managed by RAII wrappers prevent leaked descriptors across exception boundaries.\n3. Reserving capacity upfront avoids geometric reallocation copies during hot loops.',
    E'#include <iostream>\n#include <vector>\nusing namespace std;\n\nint main() {\n    vector<int> blocks = {64, 128, 256, 512};\n    int total = 0;\n\n    for (int i = 0; i < blocks.size(); i++) {\n        total += blocks[i];\n        cout << "Segment[" << i << "] = " << blocks[i] << " KB" << endl;\n    }\n\n    cout << "Total Allocated: " << total << " KB" << endl;\n    return 0;\n}',
    (select id from public.categories where slug = 'systems-cpp' limit 1),
    'Intermediate',
    9,
    '/src/assets/images/lesson_cpp_memory_1794627186736.jpg',
    'published'
  ),
  (
    '22222222-2222-4222-8222-222222222202',
    'Deterministic Binary Search & Loop Invariants',
    'deterministic-binary-search-invariants',
    'Prove termination bounds and eliminate off-by-one defects in logarithmic search partitions.',
    E'Binary search narrows a monotonic search space by half on every comparison. Correctness depends on maintaining strict boundary invariants between left and right cursors.\n\nInvariant Specification:\n- Closed interval [left, right] always encloses any valid target index.\n- Midpoint calculation divides the remaining distance without overflow.\n- Termination occurs cleanly when left > right.',
    E'#include <iostream>\n#include <vector>\nusing namespace std;\n\nint main() {\n    vector<int> nums = {4, 11, 19, 27, 42, 58, 73, 91};\n    int target;\n    cin >> target;\n\n    int left = 0;\n    int right = nums.size() - 1;\n    int found = -1;\n\n    while (left <= right) {\n        int mid = (left + right) / 2;\n        if (nums[mid] == target) {\n            found = mid;\n            left = right + 1;\n        } else if (nums[mid] < target) {\n            left = mid + 1;\n        } else {\n            right = mid - 1;\n        }\n    }\n\n    if (found != -1) {\n        cout << "Target " << target << " located at index " << found << endl;\n    } else {\n        cout << "Target " << target << " not found in buffer" << endl;\n    }\n    return 0;\n}',
    (select id from public.categories where slug = 'algorithms-graphs' limit 1),
    'Beginner',
    7,
    '/src/assets/images/lesson_algorithms_graph_1794627186970.jpg',
    'published'
  ),
  (
    '22222222-2222-4222-8222-222222222203',
    'Zero-Trust RBAC & Row-Level Security Patterns',
    'zero-trust-rbac-row-level-security',
    'Enforce role separation in database policies and backend middleware without trusting client claims.',
    E'Relying solely on client-side route guards or mutable usernames leaves administrative endpoints exposed. Production systems verify cryptographic session identity and evaluate authoritative role tables on every privileged call.\n\nDefense Checklist:\n1. Store passwords exclusively as salted cryptographic hashes (scrypt / Argon2 / Supabase Auth).\n2. Keep service-role keys strictly on the backend server environment.\n3. Force immediate rotation of bootstrap credentials on first administrator sign-in.\n4. Enforce database-level RLS policies so standard users cannot elevate their own role.',
    E'#include <iostream>\nusing namespace std;\n\nint main() {\n    int roleLevel = 1;\n    int requiredLevel = 2;\n\n    if (roleLevel >= requiredLevel) {\n        cout << "ACCESS GRANTED: ADMIN CONTROL PANEL" << endl;\n    } else {\n        cout << "ACCESS DENIED: INSUFFICIENT ROLE" << endl;\n    }\n    return 0;\n}',
    (select id from public.categories where slug = 'security-architecture' limit 1),
    'Advanced',
    11,
    '/src/assets/images/hero_cyber_knowledge_hub_1794627187265.jpg',
    'published'
  )
on conflict (slug) do nothing;

-- 3. Default Header Navigation Tabs
insert into public.header_tabs (id, label, href, sort_order, is_visible)
values
  ('33333333-3333-4333-8333-333333333301', 'Overview', '/', 1, true),
  ('33333333-3333-4333-8333-333333333302', 'Lessons', '/#catalog', 2, true),
  ('33333333-3333-4333-8333-333333333303', 'C++ Code Lab', '/cpp-lab', 3, true),
  ('33333333-3333-4333-8333-333333333304', 'Security', '/#architecture', 4, true)
on conflict (id) do nothing;

-- 4. Homepage Sections
insert into public.site_sections (id, section_type, title, subtitle, body, cta_label, cta_href, sort_order, is_visible)
values
  ('sec-hero', 'hero', 'Systems Engineering & C++ Mastery', 'DIGITAL KNOWLEDGE HUB', 'Structured technical curriculum covering memory architecture, algorithmic invariants, and zero-trust security paired with an interactive C++ execution sandbox.', 'Open C++ Code Lab', '/cpp-lab', 1, true),
  ('sec-catalog', 'catalog', 'Published Curriculum Modules', 'Technical Library', 'Browse verified systems programming, graph algorithms, and security engineering lessons.', 'Launch Sandbox', '/cpp-lab', 2, true),
  ('sec-cpplab', 'cpp_lab_promo', 'Interactive C++ Code Lab', 'Execution Sandbox', 'Write, test, and trace C++ loops, vectors, and standard input streams directly in the browser.', 'Launch C++ Code Lab', '/cpp-lab', 3, true),
  ('sec-arch', 'architecture', 'Role-Based Access & Supabase Auth Architecture', 'Platform Governance', 'Protected by server-side admin verification, salted credential hashing, reserved ADMIN bootstrap controls, and strict Row-Level Security policies.', 'Account Portal', '/login', 4, true)
on conflict (id) do nothing;

-- 5. Global Website Settings
insert into public.site_settings (id, site_name, footer_note, enable_cpp_lab, enable_search, enable_registration)
values
  ('global', 'DIGITAL KNOWLEDGE HUB', 'DIGITAL KNOWLEDGE HUB · Systems Engineering & C++ Curriculum', true, true, true)
on conflict (id) do nothing;
