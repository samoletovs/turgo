-- Keep the latest owner when an endpoint has been registered more than once.
DELETE FROM "PushSubscription"
WHERE "id" IN (
  SELECT "id" FROM (
    SELECT "id", ROW_NUMBER() OVER (
      PARTITION BY "endpoint" ORDER BY "createdAt" DESC, "id" DESC
    ) AS position
    FROM "PushSubscription"
  ) AS duplicates
  WHERE position > 1
);

CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
