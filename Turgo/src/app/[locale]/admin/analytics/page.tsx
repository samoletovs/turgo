"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AnalyticsPage() {
  const { data, isLoading } = trpc.admin.analytics.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="p-6"><div className="animate-pulse space-y-3"><div className="h-4 bg-muted rounded w-1/2" /><div className="h-32 bg-muted rounded" /></div></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const maxCatCount = Math.max(...data.categoryCounts.map((c) => c.count), 1);
  const maxCountryCount = Math.max(...data.countryCounts.map((c) => c.count), 1);
  const maxNewListings = Math.max(...data.listingsOverTime.map((p) => p.count), 1);
  const maxReg = Math.max(...data.registrationTrend.map((p) => p.count), 1);
  const maxSearch = Math.max(...data.popularSearches.map((s) => s.count), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
        <p className="text-muted-foreground">
          Listings, users, and search analytics
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Listings per Category */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Listings per Category</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.categoryCounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data</p>
            ) : (
              data.categoryCounts.map((cat) => (
                <div key={cat.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{cat.name}</span>
                    <span className="font-medium">{cat.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(cat.count / maxCatCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Listings per Country */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Listings per Country</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.countryCounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data</p>
            ) : (
              data.countryCounts.map((country) => (
                <div key={country.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{country.name} ({country.code})</span>
                    <span className="font-medium">{country.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${(country.count / maxCountryCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* New Listings Over Time (30 days) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">New Listings (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-[2px] h-40">
              {data.listingsOverTime.map((point, i) => (
                <div
                  key={i}
                  className="flex-1 bg-primary/80 hover:bg-primary rounded-t transition-colors"
                  style={{
                    height: `${(point.count / maxNewListings) * 100}%`,
                    minHeight: point.count > 0 ? 2 : 0,
                  }}
                  title={`${point.date}: ${point.count} listings`}
                />
              ))}
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
              <span>{data.listingsOverTime[0]?.date}</span>
              <span>{data.listingsOverTime[data.listingsOverTime.length - 1]?.date}</span>
            </div>
          </CardContent>
        </Card>

        {/* User Registration Trends */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">User Registrations (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-[2px] h-40">
              {data.registrationTrend.map((point, i) => (
                <div
                  key={i}
                  className="flex-1 bg-green-500/80 hover:bg-green-500 rounded-t transition-colors"
                  style={{
                    height: `${(point.count / maxReg) * 100}%`,
                    minHeight: point.count > 0 ? 2 : 0,
                  }}
                  title={`${point.date}: ${point.count} users`}
                />
              ))}
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
              <span>{data.registrationTrend[0]?.date}</span>
              <span>{data.registrationTrend[data.registrationTrend.length - 1]?.date}</span>
            </div>
          </CardContent>
        </Card>

        {/* Users by Country */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Users by Country</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.usersByCountry.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data</p>
            ) : (
              data.usersByCountry.map((country) => (
                <div key={country.name} className="flex items-center justify-between">
                  <span className="text-sm">{country.name} ({country.code})</span>
                  <Badge variant="secondary">{country.count} users</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Popular Searches (Word Cloud approximation) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Popular Searches</CardTitle>
          </CardHeader>
          <CardContent>
            {data.popularSearches.length === 0 ? (
              <p className="text-sm text-muted-foreground">No search data yet</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {data.popularSearches.map((search) => {
                  const scale = 0.7 + (search.count / maxSearch) * 1.3;
                  return (
                    <span
                      key={search.word}
                      className="inline-block rounded-md bg-muted px-2 py-1 text-foreground hover:bg-primary/10 transition-colors cursor-default"
                      style={{ fontSize: `${scale}rem` }}
                      title={`${search.count} searches`}
                    >
                      {search.word}
                    </span>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
