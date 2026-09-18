-- ============================================================================
-- RAKSHA BLOCK: BLOCK ASSIGNMENTS SCHEMA (PostgreSQL Migration)
-- Entity-relationship mapping linking maintenance requests to block windows
-- ============================================================================

CREATE TABLE IF NOT EXISTS block_assignments (
    id SERIAL PRIMARY KEY,
    request_id VARCHAR(50) NOT NULL REFERENCES maintenance_requests(request_id) ON DELETE CASCADE,
    block_id VARCHAR(50) NOT NULL,
    assigned_start_time VARCHAR(10) NOT NULL,
    assigned_end_time VARCHAR(10) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'Confirmed',
    assigned_by VARCHAR(100) NOT NULL,
    employee_id VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_active_request_assignment UNIQUE(request_id)
);

CREATE INDEX IF NOT EXISTS idx_block_assignments_block_id ON block_assignments(block_id);
CREATE INDEX IF NOT EXISTS idx_block_assignments_status ON block_assignments(status);
