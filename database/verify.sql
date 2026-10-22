-- ==============================================================================
-- FinGraph Verification Suite: Database Consistency & Integrity Verification
-- Target: PostgreSQL 14+
-- Description: Validates row counts, orphaned references, duplicate keys,
--              transaction constraints, status distributions, and AML scenarios.
-- ==============================================================================

\pset title 'FinGraph Database Layer Verification'

-- ------------------------------------------------------------------------------
-- 1. ROW COUNTS & TARGET VERIFICATION
-- ------------------------------------------------------------------------------
SELECT 
    '1. Row Counts' AS test_category,
    entity,
    actual_count,
    expected_count,
    CASE 
        WHEN actual_count = expected_count THEN 'PASS'
        ELSE 'FAIL'
    END AS status
FROM (
    SELECT 'customers' AS entity, COUNT(*) AS actual_count, 50 AS expected_count FROM customers
    UNION ALL
    SELECT 'accounts', COUNT(*), 60 FROM accounts
    UNION ALL
    SELECT 'detection_rules', COUNT(*), 7 FROM detection_rules
    UNION ALL
    SELECT 'transactions', COUNT(*), 500 FROM transactions
    UNION ALL
    SELECT 'alerts', COUNT(*), 25 FROM alerts
) count_checks;

-- ------------------------------------------------------------------------------
-- 2. REFERENTIAL INTEGRITY (ORPHAN CHECKS)
-- ------------------------------------------------------------------------------
SELECT 
    '2. Referential Integrity' AS test_category,
    check_name,
    orphan_count,
    CASE 
        WHEN orphan_count = 0 THEN 'PASS'
        ELSE 'FAIL'
    END AS status
FROM (
    SELECT 
        'accounts without valid customer' AS check_name,
        COUNT(*) AS orphan_count
    FROM accounts a
    LEFT JOIN customers c ON a.customer_id = c.id
    WHERE c.id IS NULL

    UNION ALL

    SELECT 
        'transactions with invalid source account',
        COUNT(*)
    FROM transactions t
    LEFT JOIN accounts a ON t.source_account_id = a.id
    WHERE a.id IS NULL

    UNION ALL

    SELECT 
        'transactions with invalid destination account',
        COUNT(*)
    FROM transactions t
    LEFT JOIN accounts a ON t.destination_account_id = a.id
    WHERE a.id IS NULL

    UNION ALL

    SELECT 
        'alerts with invalid transaction reference',
        COUNT(*)
    FROM alerts al
    LEFT JOIN transactions t ON al.transaction_id = t.id
    WHERE al.transaction_id IS NOT NULL AND t.id IS NULL
) orphan_checks;

-- ------------------------------------------------------------------------------
-- 3. DUPLICATE IDENTIFIERS & CONSTRAINTS
-- ------------------------------------------------------------------------------
SELECT 
    '3. Uniqueness Checks' AS test_category,
    check_name,
    duplicate_count,
    CASE 
        WHEN duplicate_count = 0 THEN 'PASS'
        ELSE 'FAIL'
    END AS status
FROM (
    SELECT 
        'duplicate customer emails' AS check_name,
        COUNT(*) - COUNT(DISTINCT email) AS duplicate_count
    FROM customers
    WHERE email IS NOT NULL

    UNION ALL

    SELECT 
        'duplicate account numbers',
        COUNT(*) - COUNT(DISTINCT account_number)
    FROM accounts

    UNION ALL

    SELECT 
        'duplicate detection rule names',
        COUNT(*) - COUNT(DISTINCT name)
    FROM detection_rules

    UNION ALL

    SELECT 
        'transactions with identical source and destination',
        COUNT(*)
    FROM transactions
    WHERE source_account_id = destination_account_id

    UNION ALL

    SELECT 
        'transactions with non-positive amount',
        COUNT(*)
    FROM transactions
    WHERE amount <= 0

    UNION ALL

    SELECT 
        'alerts with out-of-range risk scores',
        COUNT(*)
    FROM alerts
    WHERE risk_score < 0 OR risk_score > 100
) unique_checks;

-- ------------------------------------------------------------------------------
-- 4. TRANSACTION STATUS BREAKDOWN
-- ------------------------------------------------------------------------------
SELECT 
    '4. Transaction Status' AS test_category,
    status,
    COUNT(*) AS transaction_count,
    ROUND(SUM(amount), 2) AS total_volume_inr,
    ROUND(AVG(amount), 2) AS avg_amount_inr
FROM transactions
GROUP BY status
ORDER BY transaction_count DESC;

-- ------------------------------------------------------------------------------
-- 5. ACCOUNT STATUS BREAKDOWN
-- ------------------------------------------------------------------------------
SELECT 
    '5. Account Status' AS test_category,
    status,
    account_type,
    COUNT(*) AS account_count
FROM accounts
GROUP BY status, account_type
ORDER BY status, account_type;

-- ------------------------------------------------------------------------------
-- 6. MONEY LAUNDERING SCENARIOS VERIFICATION
-- ------------------------------------------------------------------------------
SELECT 
    '6. Scenario Verification' AS test_category,
    scenario_name,
    detected_count,
    expected_minimum,
    CASE 
        WHEN detected_count >= expected_minimum THEN 'PASS'
        ELSE 'FAIL'
    END AS status
FROM (
    -- Scenario 1: 3-hop circular flow (ACC-1004 -> ACC-1005 -> ACC-1006 -> ACC-1004)
    SELECT 
        'Scenario 1: 3-Hop Circular Flow Ring' AS scenario_name,
        COUNT(*) AS detected_count,
        3 AS expected_minimum
    FROM transactions
    WHERE id IN (
        'b0000000-0000-0000-0000-000000000001',
        'b0000000-0000-0000-0000-000000000002',
        'b0000000-0000-0000-0000-000000000003'
    )

    UNION ALL

    -- Scenario 2: Structuring & Smurfing just below 10 Lakh threshold into ACC-1001
    SELECT 
        'Scenario 2: Structuring Clusters (<10 Lakh INR)',
        COUNT(*),
        4
    FROM transactions
    WHERE destination_account_id = 'a0000000-0000-0000-0000-000000000001'
      AND amount BETWEEN 900000 AND 995000

    UNION ALL

    -- Scenario 3: Rapid Velocity Pass-Through on ACC-1015
    SELECT 
        'Scenario 3: Rapid Velocity Pass-Through on ACC-1015',
        COUNT(*),
        3
    FROM transactions
    WHERE source_account_id = 'a0000000-0000-0000-0000-000000000015'
      AND status = 'FLAGGED'

    UNION ALL

    -- Scenario 4: 5-Hop Extended Cycle (ACC-1020..ACC-1024)
    SELECT 
        'Scenario 4: 5-Hop Extended Ring Cycle',
        COUNT(*),
        5
    FROM transactions
    WHERE id IN (
        'b0000000-0000-0000-0000-000000000014',
        'b0000000-0000-0000-0000-000000000015',
        'b0000000-0000-0000-0000-000000000016',
        'b0000000-0000-0000-0000-000000000017',
        'b0000000-0000-0000-0000-000000000018'
    )

    UNION ALL

    -- Scenario 5: Multi-Hop Linear Layering Chain (ACC-1030..ACC-1034)
    SELECT 
        'Scenario 5: Multi-Hop Linear Layering Chain',
        COUNT(*),
        4
    FROM transactions
    WHERE id IN (
        'b0000000-0000-0000-0000-000000000019',
        'b0000000-0000-0000-0000-000000000020',
        'b0000000-0000-0000-0000-000000000021',
        'b0000000-0000-0000-0000-000000000022'
    )

    UNION ALL

    -- Scenario 6: Shared Intermediary (Fan-In -> Fan-Out Mule ACC-1010)
    SELECT 
        'Scenario 6: Shared Intermediary Mule Consolidation (ACC-1010)',
        COUNT(*),
        11
    FROM transactions
    WHERE source_account_id = 'a0000000-0000-0000-0000-000000000010'
       OR destination_account_id = 'a0000000-0000-0000-0000-000000000010'

    UNION ALL

    -- Scenario 7: High-Frequency Split Transfers from ACC-1050
    SELECT 
        'Scenario 7: Split High-Frequency Dispersal (ACC-1050)',
        COUNT(*),
        8
    FROM transactions
    WHERE source_account_id = 'a0000000-0000-0000-0000-000000000050'
      AND status = 'FLAGGED'

    UNION ALL

    -- Scenario 8: Dormant Account Reactivation Spikes (ACC-1055, ACC-1056)
    SELECT 
        'Scenario 8: Dormancy Reactivation Spikes',
        COUNT(*),
        2
    FROM transactions
    WHERE source_account_id IN (
        'a0000000-0000-0000-0000-000000000055',
        'a0000000-0000-0000-0000-000000000056'
    )

    UNION ALL

    -- Scenario 9: Failed, Rejected, Cancelled and Pending Transactions
    SELECT 
        'Scenario 9: Non-Completed Transaction States',
        COUNT(*),
        15
    FROM transactions
    WHERE status IN ('REJECTED', 'CANCELLED', 'PENDING', 'FAILED')
) scenario_checks;

-- ------------------------------------------------------------------------------
-- 7. OVERALL VERIFICATION VERDICT
-- ------------------------------------------------------------------------------
SELECT 
    CASE 
        WHEN (SELECT COUNT(*) FROM customers) = 50
         AND (SELECT COUNT(*) FROM accounts) = 60
         AND (SELECT COUNT(*) FROM detection_rules) = 7
         AND (SELECT COUNT(*) FROM transactions) = 500
         AND (SELECT COUNT(*) FROM alerts) = 25
         AND (SELECT COUNT(*) FROM accounts a LEFT JOIN customers c ON a.customer_id = c.id WHERE c.id IS NULL) = 0
         AND (SELECT COUNT(*) FROM transactions t LEFT JOIN accounts a ON t.source_account_id = a.id WHERE a.id IS NULL) = 0
         AND (SELECT COUNT(*) FROM transactions t LEFT JOIN accounts a ON t.destination_account_id = a.id WHERE a.id IS NULL) = 0
         AND (SELECT COUNT(*) FROM alerts al LEFT JOIN transactions t ON al.transaction_id = t.id WHERE al.transaction_id IS NOT NULL AND t.id IS NULL) = 0
         AND (SELECT COUNT(*) FROM transactions WHERE source_account_id = destination_account_id) = 0
         AND (SELECT COUNT(*) FROM transactions WHERE amount <= 0) = 0
         AND (SELECT COUNT(*) FROM alerts WHERE risk_score < 0 OR risk_score > 100) = 0
        THEN 'VERIFICATION PASSED: All 50 customers, 60 accounts, 7 rules, 500 transactions, and 25 alerts are referentially valid.'
        ELSE 'VERIFICATION FAILED: Inconsistencies detected. Check individual test sections above.'
    END AS final_verdict;
