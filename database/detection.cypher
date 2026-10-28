// Neo4j Browser/native Cypher examples. No APOC required.
// Parameters: currency='INR', windowHours=72, retention=0.85, limit=100.
// Amounts in the projection are exact decimal strings. toFloat below is for
// exploratory native queries only; the application engine uses bigint cents.

// Short chronological simple cycles. Application fingerprints deduplicate rotations.
MATCH p = (a:Account)-[:TRANSFER*3..6]->(a)
WITH p, relationships(p) AS rs, nodes(p)[0..length(p)] AS accounts
WHERE ALL(r IN rs WHERE r.status IN ['COMPLETED', 'FLAGGED'] AND r.currency = $currency)
  AND ALL(n IN accounts WHERE single(m IN accounts WHERE m = n))
  AND ALL(i IN range(0, size(rs) - 2) WHERE
    rs[i].occurredAt <= rs[i + 1].occurredAt AND
    toFloat(rs[i + 1].amount) <= toFloat(rs[i].amount))
  AND last(rs).occurredAt <= head(rs).occurredAt + duration({hours: $windowHours})
  AND toFloat(last(rs).amount) >= toFloat(head(rs).amount) * $retention
RETURN [n IN nodes(p) | n.accountId] AS accountPath,
       [r IN rs | r.transactionId] AS transactionIds, length(p) AS hops
LIMIT $limit;

// Open layering paths (parameters above plus minAmount=2000000, hopHours=24).
MATCH p = (a:Account)-[:TRANSFER*4..6]->(b:Account)
WITH p, relationships(p) AS rs, nodes(p) AS accounts
WHERE head(accounts) <> last(accounts)
  AND ALL(n IN accounts WHERE single(m IN accounts WHERE m = n))
  AND ALL(r IN rs WHERE r.status IN ['COMPLETED', 'FLAGGED'] AND r.currency = $currency)
  AND toFloat(head(rs).amount) >= $minAmount
  AND ALL(i IN range(0, size(rs) - 2) WHERE
    rs[i].occurredAt <= rs[i + 1].occurredAt AND
    rs[i + 1].occurredAt <= rs[i].occurredAt + duration({hours: $hopHours}) AND
    toFloat(rs[i + 1].amount) <= toFloat(rs[i].amount))
  AND toFloat(last(rs).amount) >= toFloat(head(rs).amount) * $retention
RETURN [n IN accounts | n.accountId] AS accountPath,
       [r IN rs | r.transactionId] AS transactionIds
LIMIT $limit;

// Rapid pass-through candidate pairs (velocityHours=2).
// Candidate pairs alone do not perform the application's FIFO attribution.
MATCH (source:Account)-[incoming:TRANSFER]->(hub:Account)-[outgoing:TRANSFER]->(target:Account)
WHERE incoming.status IN ['COMPLETED', 'FLAGGED']
  AND outgoing.status IN ['COMPLETED', 'FLAGGED']
  AND incoming.currency = $currency AND outgoing.currency = $currency
  AND incoming.occurredAt <= outgoing.occurredAt
  AND outgoing.occurredAt <= incoming.occurredAt + duration({hours: $velocityHours})
RETURN hub.accountId AS intermediary, incoming.transactionId AS incomingId,
       outgoing.transactionId AS outgoingId
LIMIT $limit;
