-- ============================================================================
-- RAKSHA BLOCK: COMPLETE NORMALIZED RELATIONAL DATABASE SCHEMA (PostgreSQL)
-- Smart India Hackathon 2026 - AI-Powered Automatic Block Planning
-- ============================================================================

-- Drop existing tables to establish clean normalized relational structure
DROP TABLE IF EXISTS what_if_conflicts CASCADE;
DROP TABLE IF EXISTS what_if_scenarios CASCADE;
DROP TABLE IF EXISTS coordination_bundle_tasks CASCADE;
DROP TABLE IF EXISTS coordination_bundles CASCADE;
DROP TABLE IF EXISTS block_plan_tasks CASCADE;
DROP TABLE IF EXISTS scheduled_tasks CASCADE;
DROP TABLE IF EXISTS block_plans CASCADE;
DROP TABLE IF EXISTS block_assignments CASCADE;
DROP TABLE IF EXISTS conflicts CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS user_preferences CASCADE;
DROP TABLE IF EXISTS maintenance_requests CASCADE;
DROP TABLE IF EXISTS block_windows CASCADE;
DROP TABLE IF EXISTS trains CASCADE;
DROP TABLE IF EXISTS assets CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS corridors CASCADE;
DROP TABLE IF EXISTS departments CASCADE;

-- 1. DEPARTMENTS
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CORRIDORS
CREATE TABLE corridors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    division VARCHAR(100) DEFAULT 'Eastern Railway',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. PROFILES
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    role VARCHAR(100) NOT NULL,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    division VARCHAR(100) DEFAULT 'Howrah',
    section VARCHAR(100),
    password_hash VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ASSETS
CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_code VARCHAR(50) UNIQUE NOT NULL,
    asset_name VARCHAR(150) NOT NULL,
    asset_type VARCHAR(100) NOT NULL,
    corridor_id UUID REFERENCES corridors(id) ON DELETE CASCADE,
    location VARCHAR(150),
    km_marker VARCHAR(50),
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    risk_level VARCHAR(30) DEFAULT 'Medium',
    status VARCHAR(30) DEFAULT 'Operational',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. MAINTENANCE REQUESTS
CREATE TABLE maintenance_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_code VARCHAR(50) UNIQUE NOT NULL,
    asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    corridor_id UUID NOT NULL REFERENCES corridors(id) ON DELETE CASCADE,
    submitted_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    work_description TEXT NOT NULL,
    location VARCHAR(150),
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
    priority_level VARCHAR(30) NOT NULL DEFAULT 'Medium',
    priority_score NUMERIC DEFAULT 50,
    urgency_score NUMERIC DEFAULT 50,
    asset_risk_score NUMERIC DEFAULT 50,
    due_date DATE,
    traffic_impact_score NUMERIC DEFAULT 50,
    status VARCHAR(30) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Planned', 'Scheduled', 'In Progress', 'Completed', 'Cancelled', 'Rejected')),
    reason TEXT,
    assigned_block_id VARCHAR(50),
    scheduled_slot VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TRAINS
CREATE TABLE trains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    train_id VARCHAR(50) UNIQUE NOT NULL,
    train_number VARCHAR(50) UNIQUE NOT NULL,
    train_name VARCHAR(150) NOT NULL,
    train_type VARCHAR(50) NOT NULL,
    corridor_id UUID REFERENCES corridors(id) ON DELETE CASCADE,
    origin VARCHAR(100),
    destination VARCHAR(100),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    running_date DATE DEFAULT CURRENT_DATE,
    priority VARCHAR(30) DEFAULT 'Normal',
    status VARCHAR(30) DEFAULT 'Active',
    delay_minutes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. BLOCK WINDOWS
CREATE TABLE block_windows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    block_code VARCHAR(50) UNIQUE NOT NULL,
    corridor_id UUID NOT NULL REFERENCES corridors(id) ON DELETE CASCADE,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
    status VARCHAR(30) DEFAULT 'Available' CHECK (status IN ('Available', 'Reserved', 'Partially Occupied', 'Occupied', 'Closed')),
    occupied_minutes INTEGER DEFAULT 0,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. BLOCK ASSIGNMENTS
CREATE TABLE block_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
    block_window_id UUID NOT NULL REFERENCES block_windows(id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    assigned_start_time TIMESTAMPTZ,
    assigned_end_time TIMESTAMPTZ,
    status VARCHAR(30) DEFAULT 'Assigned' CHECK (status IN ('Assigned', 'Confirmed', 'Cancelled', 'Completed')),
    assignment_reason TEXT,
    suitability_score NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_active_request_assignment UNIQUE(request_id)
);

-- 9. BLOCK PLANS
CREATE TABLE block_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150),
    corridor_id UUID REFERENCES corridors(id) ON DELETE SET NULL,
    generated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    status VARCHAR(30) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Recommended', 'Approved', 'Rejected', 'Completed')),
    generation_reason TEXT,
    total_tasks INTEGER DEFAULT 0,
    total_duration_minutes INTEGER DEFAULT 0,
    approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    rejected_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. SCHEDULED TASKS
CREATE TABLE scheduled_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_code VARCHAR(50) UNIQUE NOT NULL,
    request_id UUID NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
    block_assignment_id UUID REFERENCES block_assignments(id) ON DELETE SET NULL,
    block_plan_id UUID REFERENCES block_plans(id) ON DELETE SET NULL,
    corridor_id UUID NOT NULL REFERENCES corridors(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    scheduled_start TIMESTAMPTZ NOT NULL,
    scheduled_end TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL,
    status VARCHAR(30) DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'In Progress', 'Completed', 'Cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. BLOCK PLAN TASKS
CREATE TABLE block_plan_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    block_plan_id UUID NOT NULL REFERENCES block_plans(id) ON DELETE CASCADE,
    request_id UUID NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
    block_window_id UUID REFERENCES block_windows(id) ON DELETE SET NULL,
    scheduled_task_id UUID REFERENCES scheduled_tasks(id) ON DELETE SET NULL,
    sequence_number INTEGER DEFAULT 1,
    planned_start TIMESTAMPTZ,
    planned_end TIMESTAMPTZ,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. CONFLICTS
CREATE TABLE conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conflict_code VARCHAR(50) UNIQUE NOT NULL,
    request_id UUID REFERENCES maintenance_requests(id) ON DELETE SET NULL,
    train_id UUID REFERENCES trains(id) ON DELETE SET NULL,
    block_window_id UUID REFERENCES block_windows(id) ON DELETE SET NULL,
    scheduled_task_id UUID REFERENCES scheduled_tasks(id) ON DELETE SET NULL,
    corridor_id UUID REFERENCES corridors(id) ON DELETE CASCADE,
    conflict_type VARCHAR(50) NOT NULL CHECK (conflict_type IN ('TRAIN', 'MAINTENANCE', 'BLOCK_WINDOW', 'RESOURCE', 'CORRIDOR', 'BUFFER')),
    severity VARCHAR(30) DEFAULT 'High' CHECK (severity IN ('Critical', 'High', 'Medium', 'Low')),
    conflict_start TIMESTAMPTZ,
    conflict_end TIMESTAMPTZ,
    description TEXT,
    resolution TEXT,
    status VARCHAR(30) DEFAULT 'Active' CHECK (status IN ('Active', 'Resolved', 'Ignored')),
    resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. COORDINATION BUNDLES
CREATE TABLE coordination_bundles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bundle_code VARCHAR(50) UNIQUE NOT NULL,
    corridor_id UUID REFERENCES corridors(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    status VARCHAR(30) DEFAULT 'Proposed' CHECK (status IN ('Proposed', 'Approved', 'Rejected', 'Executed')),
    combined_duration_minutes INTEGER DEFAULT 0,
    time_saved_minutes INTEGER DEFAULT 0,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. COORDINATION BUNDLE TASKS
CREATE TABLE coordination_bundle_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bundle_id UUID NOT NULL REFERENCES coordination_bundles(id) ON DELETE CASCADE,
    request_id UUID NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. WHAT-IF SCENARIOS
CREATE TABLE what_if_scenarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_code VARCHAR(50) UNIQUE NOT NULL,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    corridor_id UUID REFERENCES corridors(id) ON DELETE CASCADE,
    base_block_plan_id UUID REFERENCES block_plans(id) ON DELETE SET NULL,
    proposed_start TIMESTAMPTZ NOT NULL,
    proposed_end TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL,
    feasible BOOLEAN DEFAULT FALSE,
    conflict_count INTEGER DEFAULT 0,
    safety_buffer_minutes INTEGER DEFAULT 0,
    reason TEXT,
    status VARCHAR(30) DEFAULT 'Evaluated' CHECK (status IN ('Evaluated', 'Accepted', 'Rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. WHAT-IF CONFLICTS
CREATE TABLE what_if_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_id UUID NOT NULL REFERENCES what_if_scenarios(id) ON DELETE CASCADE,
    conflict_type VARCHAR(50),
    train_id UUID REFERENCES trains(id) ON DELETE SET NULL,
    request_id UUID REFERENCES maintenance_requests(id) ON DELETE SET NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 17. NOTIFICATIONS
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) DEFAULT 'INFO',
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(30) DEFAULT 'Normal',
    related_request_id UUID REFERENCES maintenance_requests(id) ON DELETE SET NULL,
    related_conflict_id UUID REFERENCES conflicts(id) ON DELETE SET NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 18. USER PREFERENCES
CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    theme VARCHAR(30) DEFAULT 'light',
    notifications_enabled BOOLEAN DEFAULT TRUE,
    default_corridor_id UUID REFERENCES corridors(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 19. AUDIT LOGS
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES FOR HIGH-PERFORMANCE OPERATIONAL QUERIES
CREATE INDEX idx_req_status ON maintenance_requests(status);
CREATE INDEX idx_req_corridor ON maintenance_requests(corridor_id);
CREATE INDEX idx_req_dept ON maintenance_requests(department_id);
CREATE INDEX idx_req_priority ON maintenance_requests(priority_level);

CREATE INDEX idx_trains_corridor ON trains(corridor_id);
CREATE INDEX idx_trains_time ON trains(start_time, end_time);

CREATE INDEX idx_windows_corridor ON block_windows(corridor_id);
CREATE INDEX idx_windows_time ON block_windows(start_time, end_time);
CREATE INDEX idx_windows_status ON block_windows(status);

CREATE INDEX idx_conflicts_status ON conflicts(status);
CREATE INDEX idx_conflicts_corridor ON conflicts(corridor_id);

CREATE INDEX idx_assignments_req ON block_assignments(request_id);
CREATE INDEX idx_assignments_window ON block_assignments(block_window_id);

CREATE INDEX idx_plan_tasks_plan ON block_plan_tasks(block_plan_id);
CREATE INDEX idx_plan_tasks_req ON block_plan_tasks(request_id);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
