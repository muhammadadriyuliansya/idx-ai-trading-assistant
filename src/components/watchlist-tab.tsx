"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Search,
  Trash2,
  Bell,
  BellOff,
  Eye,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocalStorage } from "@/lib/storage";
import { formatCurrency } from "@/lib/utils";

interface WatchlistItem {
  id: string;
  ticker: string;
  addedAt: number;
  notes?: string;
  targetPrice?: number;
  alertEnabled: boolean;
  currentPrice?: number;
  lastUpdated?: number;
}

interface PriceAlert {
  id: string;
  ticker: string;
  condition: "ABOVE" | "BELOW" | "CROSS" | "VOLUME";
  targetValue: number;
  createdAt: number;
  triggered: boolean;
  triggeredAt?: number;
}

const STORAGE_KEYS = {
  watchlist: "idxai.watchlist.manual",
  alerts: "idxai.alerts.manual",
};

export function WatchlistTab() {
  const [watchlist, setWatchlist] = useLocalStorage<WatchlistItem[]>(STORAGE_KEYS.watchlist, []);
  const [alerts, setAlerts] = useLocalStorage<PriceAlert[]>(STORAGE_KEYS.alerts, []);
  
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddAlert, setShowAddAlert] = useState(false);
  const [filterTicker, setFilterTicker] = useState("");

  const [newItem, setNewItem] = useState({
    ticker: "",
    notes: "",
    targetPrice: "",
  });

  const [newAlert, setNewAlert] = useState({
    ticker: "",
    condition: "ABOVE" as "ABOVE" | "BELOW" | "CROSS" | "VOLUME",
    targetValue: "",
  });

  const handleAddItem = () => {
    if (!newItem.ticker) return;

    const item: WatchlistItem = {
      id: Date.now().toString(),
      ticker: newItem.ticker.toUpperCase(),
      addedAt: Date.now(),
      notes: newItem.notes,
      targetPrice: newItem.targetPrice ? parseFloat(newItem.targetPrice) : undefined,
      alertEnabled: false,
    };

    setWatchlist([...watchlist, item]);
    setNewItem({ ticker: "", notes: "", targetPrice: "" });
    setShowAddItem(false);
  };

  const handleRemoveItem = (id: string) => {
    setWatchlist(watchlist.filter(item => item.id !== id));
  };

  const handleToggleAlert = (id: string) => {
    setWatchlist(watchlist.map(item => 
      item.id === id ? { ...item, alertEnabled: !item.alertEnabled } : item
    ));
  };

  const handleAddAlert = () => {
    if (!newAlert.ticker || !newAlert.targetValue) return;

    const alert: PriceAlert = {
      id: Date.now().toString(),
      ticker: newAlert.ticker.toUpperCase(),
      condition: newAlert.condition,
      targetValue: parseFloat(newAlert.targetValue),
      createdAt: Date.now(),
      triggered: false,
    };

    setAlerts([...alerts, alert]);
    setNewAlert({ ticker: "", condition: "ABOVE", targetValue: "" });
    setShowAddAlert(false);
  };

  const handleRemoveAlert = (id: string) => {
    setAlerts(alerts.filter(a => a.id !== id));
  };

  const handleTriggerAlert = (id: string) => {
    setAlerts(alerts.map(a => 
      a.id === id ? { ...a, triggered: true, triggeredAt: Date.now() } : a
    ));
  };

  const filteredWatchlist = watchlist.filter(item => 
    item.ticker.toLowerCase().includes(filterTicker.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Watchlist</h2>
          <p className="text-zinc-400">Monitor saham yang интересую вас</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowAddAlert(true)}>
            <Bell className="h-4 w-4" />
            Add Alert
          </Button>
          <Button onClick={() => setShowAddItem(true)}>
            <Plus className="h-4 w-4" />
            Add Stock
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <Input
          placeholder="Filter by ticker..."
          value={filterTicker}
          onChange={(e) => setFilterTicker(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Active Alerts */}
      {alerts.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/10">
          <CardContent className="p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-400">
              <Bell className="h-4 w-4" />
              Active Alerts ({alerts.filter(a => !a.triggered).length})
            </h3>
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <span className="font-mono font-bold">{alert.ticker}</span>
                      <span className="text-zinc-500">
                        {" "}{alert.condition === "ABOVE" ? ">" : alert.condition === "BELOW" ? "<" : "cross"} {formatCurrency(alert.targetValue)}
                      </span>
                    </div>
                    <Badge tone={alert.triggered ? "emerald" : "amber"}>
                      {alert.triggered ? "TRIGGERED" : "ACTIVE"}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    {!alert.triggered && (
                      <Button size="sm" variant="outline" onClick={() => handleTriggerAlert(alert.id)}>
                        Trigger
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => handleRemoveAlert(alert.id)}>
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Watchlist Items */}
      <Card className="border-zinc-800">
        <CardContent className="p-4">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Eye className="h-5 w-5 text-emerald-400" />
            Watchlist ({filteredWatchlist.length})
          </h3>
          
          {filteredWatchlist.length === 0 ? (
            <div className="py-12 text-center text-zinc-500">
              <Eye className="mx-auto h-12 w-12 opacity-30" />
              <div className="mt-4 font-medium">Watchlist kosong</div>
              <div className="mt-2 text-sm">Klik &quot;Add Stock&quot; untuk menambah</div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredWatchlist.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 p-4"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xl font-bold">{item.ticker}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggleAlert(item.id)}
                        >
                          {item.alertEnabled ? (
                            <Bell className="h-4 w-4 text-amber-400" />
                          ) : (
                            <BellOff className="h-4 w-4 text-zinc-500" />
                          )}
                        </Button>
                      </div>
                      <div className="text-xs text-zinc-500">
                        Added {new Date(item.addedAt).toLocaleDateString("id-ID")}
                      </div>
                      {item.notes && (
                        <div className="mt-1 text-sm text-zinc-400">{item.notes}</div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {item.targetPrice && (
                      <div className="text-right">
                        <div className="text-xs text-zinc-500">Target</div>
                        <div className="font-mono text-emerald-400">{formatCurrency(item.targetPrice)}</div>
                      </div>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        // Emit event to analyze this ticker
                        window.dispatchEvent(new CustomEvent("analyze-ticker", { detail: item.ticker }));
                      }}
                    >
                      <Zap className="h-4 w-4" />
                      Analyze
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveItem(item.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-zinc-800">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold">{watchlist.length}</div>
            <div className="text-sm text-zinc-500">Total Stocks</div>
          </CardContent>
        </Card>
        <Card className="border-zinc-800">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold">{alerts.filter(a => !a.triggered).length}</div>
            <div className="text-sm text-zinc-500">Active Alerts</div>
          </CardContent>
        </Card>
        <Card className="border-zinc-800">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold">{alerts.filter(a => a.triggered).length}</div>
            <div className="text-sm text-zinc-500">Triggered</div>
          </CardContent>
        </Card>
      </div>

      {/* Add Item Modal */}
      {showAddItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-6">
            <h3 className="mb-4 text-lg font-semibold">Add to Watchlist</h3>
            <div className="space-y-4">
              <div>
                <Label>Ticker</Label>
                <Input
                  placeholder="BBRI"
                  value={newItem.ticker}
                  onChange={(e) => setNewItem({ ...newItem, ticker: e.target.value.toUpperCase() })}
                  className="font-mono"
                />
              </div>
              <div>
                <Label>Target Price (Optional)</Label>
                <Input
                  type="number"
                  placeholder="5000"
                  value={newItem.targetPrice}
                  onChange={(e) => setNewItem({ ...newItem, targetPrice: e.target.value })}
                  className="font-mono"
                />
              </div>
              <div>
                <Label>Notes (Optional)</Label>
                <Input
                  placeholder="Why are you watching this?"
                  value={newItem.notes}
                  onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <Button variant="outline" onClick={() => setShowAddItem(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleAddItem} className="flex-1">
                Add
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Alert Modal */}
      {showAddAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-6">
            <h3 className="mb-4 text-lg font-semibold">Create Price Alert</h3>
            <div className="space-y-4">
              <div>
                <Label>Ticker</Label>
                <Input
                  placeholder="BBRI"
                  value={newAlert.ticker}
                  onChange={(e) => setNewAlert({ ...newAlert, ticker: e.target.value.toUpperCase() })}
                  className="font-mono"
                />
              </div>
              <div>
                <Label>Condition</Label>
                <div className="flex gap-2">
                  {(["ABOVE", "BELOW", "CROSS", "VOLUME"] as const).map((cond) => (
                    <Button
                      key={cond}
                      variant={newAlert.condition === cond ? "default" : "outline"}
                      size="sm"
                      onClick={() => setNewAlert({ ...newAlert, condition: cond })}
                    >
                      {cond}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Target Value</Label>
                <Input
                  type="number"
                  placeholder="5000"
                  value={newAlert.targetValue}
                  onChange={(e) => setNewAlert({ ...newAlert, targetValue: e.target.value })}
                  className="font-mono"
                />
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <Button variant="outline" onClick={() => setShowAddAlert(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleAddAlert} className="flex-1">
                Create Alert
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
