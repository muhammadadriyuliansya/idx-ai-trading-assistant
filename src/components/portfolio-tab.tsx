"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Minus,
  TrendingUp,
  TrendingDown,
  Wallet,
  Percent,
  DollarSign,
  Calendar,
  BarChart3,
  Edit2,
  Trash2,
  Download,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocalStorage } from "@/lib/storage";
import { formatCurrency } from "@/lib/utils";

interface Position {
  id: string;
  ticker: string;
  entryPrice: number;
  shares: number;
  entryDate: number;
  currentPrice?: number;
  notes?: string;
  targetPrice?: number;
  stopLoss?: number;
}

interface TradeHistory {
  id: string;
  ticker: string;
  type: "BUY" | "SELL";
  price: number;
  shares: number;
  date: number;
  pnl?: number;
  notes?: string;
}

const STORAGE_KEYS = {
  positions: "idxai.portfolio.positions",
  tradeHistory: "idxai.portfolio.history",
};

export function PortfolioTab() {
  const [positions, setPositions] = useLocalStorage<Position[]>(STORAGE_KEYS.positions, []);
  const [tradeHistory, setTradeHistory] = useLocalStorage<TradeHistory[]>(STORAGE_KEYS.tradeHistory, []);
  
  const [showAddPosition, setShowAddPosition] = useState(false);
  const [showAddTrade, setShowAddTrade] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [newPosition, setNewPosition] = useState({
    ticker: "",
    entryPrice: "",
    shares: "",
    notes: "",
    targetPrice: "",
    stopLoss: "",
  });

  const [newTrade, setNewTrade] = useState({
    ticker: "",
    type: "BUY" as "BUY" | "SELL",
    price: "",
    shares: "",
    notes: "",
  });

  // Calculate totals
  const totalInvested = positions.reduce((sum, p) => sum + p.entryPrice * p.shares, 0);
  const totalValue = positions.reduce((sum, p) => {
    const currentPrice = p.currentPrice || p.entryPrice;
    return sum + currentPrice * p.shares;
  }, 0);
  const totalPnL = totalValue - totalInvested;
  const totalPnLPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

  // Closed P&L
  const closedPnL = tradeHistory
    .filter(t => t.pnl !== undefined)
    .reduce((sum, t) => sum + (t.pnl || 0), 0);

  const handleAddPosition = () => {
    if (!newPosition.ticker || !newPosition.entryPrice || !newPosition.shares) return;

    const position: Position = {
      id: Date.now().toString(),
      ticker: newPosition.ticker.toUpperCase(),
      entryPrice: parseFloat(newPosition.entryPrice),
      shares: parseInt(newPosition.shares),
      entryDate: Date.now(),
      currentPrice: parseFloat(newPosition.entryPrice),
      notes: newPosition.notes,
      targetPrice: newPosition.targetPrice ? parseFloat(newPosition.targetPrice) : undefined,
      stopLoss: newPosition.stopLoss ? parseFloat(newPosition.stopLoss) : undefined,
    };

    setPositions([...positions, position]);
    setNewPosition({ ticker: "", entryPrice: "", shares: "", notes: "", targetPrice: "", stopLoss: "" });
    setShowAddPosition(false);

    // Add to trade history
    setTradeHistory([...tradeHistory, {
      id: Date.now().toString(),
      ticker: position.ticker,
      type: "BUY",
      price: position.entryPrice,
      shares: position.shares,
      date: Date.now(),
    }]);
  };

  const handleRemovePosition = (id: string) => {
    setPositions(positions.filter(p => p.id !== id));
  };

  const handleUpdatePrice = (id: string, currentPrice: number) => {
    setPositions(positions.map(p => p.id === id ? { ...p, currentPrice } : p));
  };

  const handleClosePosition = (id: string, sellPrice: number) => {
    const position = positions.find(p => p.id === id);
    if (!position) return;

    const pnl = (sellPrice - position.entryPrice) * position.shares;
    
    setTradeHistory([...tradeHistory, {
      id: Date.now().toString(),
      ticker: position.ticker,
      type: "SELL",
      price: sellPrice,
      shares: position.shares,
      date: Date.now(),
      pnl,
    }]);

    setPositions(positions.filter(p => p.id !== id));
  };

  const exportToCSV = () => {
    const headers = ["Date", "Ticker", "Type", "Price", "Shares", "Value", "P&L", "Notes"];
    const rows = tradeHistory.map(t => [
      new Date(t.date).toLocaleDateString("id-ID"),
      t.ticker,
      t.type,
      t.price.toString(),
      t.shares.toString(),
      (t.price * t.shares).toString(),
      t.pnl?.toString() || "",
      t.notes || "",
    ]);
    
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `portfolio-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Portfolio Tracker</h2>
          <p className="text-zinc-400">Kelola posisi dan tracking P&L</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button onClick={() => setShowAddPosition(true)}>
            <Plus className="h-4 w-4" />
            Add Position
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-zinc-500">
              <Wallet className="h-4 w-4" />
              <span className="text-sm">Total Invested</span>
            </div>
            <div className="mt-2 font-mono text-2xl font-bold">
              {formatCurrency(totalInvested)}
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-zinc-500">
              <BarChart3 className="h-4 w-4" />
              <span className="text-sm">Current Value</span>
            </div>
            <div className="mt-2 font-mono text-2xl font-bold">
              {formatCurrency(totalValue)}
            </div>
          </CardContent>
        </Card>

        <Card className={`border-zinc-800 ${totalPnL >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-zinc-500">
              {totalPnL >= 0 ? (
                <TrendingUp className="h-4 w-4 text-emerald-400" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-400" />
              )}
              <span className="text-sm">Unrealized P&L</span>
            </div>
            <div className={`mt-2 font-mono text-2xl font-bold ${totalPnL >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {totalPnL >= 0 ? "+" : ""}{formatCurrency(totalPnL)}
            </div>
            <div className={`text-sm ${totalPnLPct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {totalPnLPct >= 0 ? "+" : ""}{totalPnLPct.toFixed(2)}%
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-zinc-500">
              <Percent className="h-4 w-4" />
              <span className="text-sm">Closed P&L</span>
            </div>
            <div className={`mt-2 font-mono text-2xl font-bold ${closedPnL >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {closedPnL >= 0 ? "+" : ""}{formatCurrency(closedPnL)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Open Positions */}
      <Card className="border-zinc-800">
        <CardContent className="p-4">
          <h3 className="mb-4 text-lg font-semibold">Open Positions</h3>
          
          {positions.length === 0 ? (
            <div className="py-8 text-center text-zinc-500">
              <Wallet className="mx-auto h-12 w-12 opacity-30" />
              <div className="mt-4 font-medium">Belum ada posisi terbuka</div>
              <div className="mt-2 text-sm">Klik &quot;Add Position&quot; untuk menambah</div>
            </div>
          ) : (
            <div className="space-y-3">
              {positions.map((position) => {
                const currentValue = (position.currentPrice || position.entryPrice) * position.shares;
                const pnl = (position.currentPrice || position.entryPrice - position.entryPrice) * position.shares;
                const pnlPct = ((position.currentPrice || position.entryPrice) - position.entryPrice) / position.entryPrice * 100;

                return (
                  <motion.div
                    key={position.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 p-4"
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="font-mono text-lg font-bold">{position.ticker}</div>
                        <div className="text-xs text-zinc-500">
                          {position.shares} lots @ {formatCurrency(position.entryPrice)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      {/* Current Price Input */}
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          placeholder="Current"
                          value={position.currentPrice || ""}
                          onChange={(e) => handleUpdatePrice(position.id, parseFloat(e.target.value) || position.entryPrice)}
                          className="w-24 font-mono"
                        />
                      </div>

                      <div className="text-right">
                        <div className="font-mono text-lg font-bold">{formatCurrency(currentValue)}</div>
                        <div className={`text-sm ${pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {pnl >= 0 ? "+" : ""}{formatCurrency(pnl)} ({pnlPct.toFixed(1)}%)
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {position.targetPrice && (
                          <span className="rounded bg-emerald-500/20 px-2 py-1 text-xs text-emerald-400">
                            TP: {formatCurrency(position.targetPrice)}
                          </span>
                        )}
                        {position.stopLoss && (
                          <span className="rounded bg-red-500/20 px-2 py-1 text-xs text-red-400">
                            SL: {formatCurrency(position.stopLoss)}
                          </span>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleClosePosition(position.id, position.currentPrice || position.entryPrice)}
                        >
                          Close
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemovePosition(position.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trade History */}
      <Card className="border-zinc-800">
        <CardContent className="p-4">
          <h3 className="mb-4 text-lg font-semibold">Trade History</h3>
          
          {tradeHistory.length === 0 ? (
            <div className="py-8 text-center text-zinc-500">
              <Calendar className="mx-auto h-12 w-12 opacity-30" />
              <div className="mt-4 font-medium">Belum ada trade history</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500">
                    <th className="pb-2 text-left">Date</th>
                    <th className="pb-2 text-left">Ticker</th>
                    <th className="pb-2 text-left">Type</th>
                    <th className="pb-2 text-right">Price</th>
                    <th className="pb-2 text-right">Shares</th>
                    <th className="pb-2 text-right">Value</th>
                    <th className="pb-2 text-right">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {[...tradeHistory].reverse().slice(0, 20).map((trade) => (
                    <tr key={trade.id} className="border-b border-zinc-800/50">
                      <td className="py-2">{new Date(trade.date).toLocaleDateString("id-ID")}</td>
                      <td className="font-mono font-medium">{trade.ticker}</td>
                      <td>
                        <Badge tone={trade.type === "BUY" ? "emerald" : "blue"}>
                          {trade.type}
                        </Badge>
                      </td>
                      <td className="text-right font-mono">{formatCurrency(trade.price)}</td>
                      <td className="text-right">{trade.shares}</td>
                      <td className="text-right font-mono">{formatCurrency(trade.price * trade.shares)}</td>
                      <td className={`text-right font-mono ${trade.pnl && trade.pnl >= 0 ? "text-emerald-400" : trade.pnl && trade.pnl < 0 ? "text-red-400" : "text-zinc-500"}`}>
                        {trade.pnl ? `${trade.pnl >= 0 ? "+" : ""}${formatCurrency(trade.pnl)}` : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Position Modal */}
      {showAddPosition && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-6">
            <h3 className="mb-4 text-lg font-semibold">Add Position</h3>
            <div className="space-y-4">
              <div>
                <Label>Ticker</Label>
                <Input
                  placeholder="BBRI"
                  value={newPosition.ticker}
                  onChange={(e) => setNewPosition({ ...newPosition, ticker: e.target.value.toUpperCase() })}
                  className="font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Entry Price</Label>
                  <Input
                    type="number"
                    placeholder="4500"
                    value={newPosition.entryPrice}
                    onChange={(e) => setNewPosition({ ...newPosition, entryPrice: e.target.value })}
                    className="font-mono"
                  />
                </div>
                <div>
                  <Label>Shares</Label>
                  <Input
                    type="number"
                    placeholder="100"
                    value={newPosition.shares}
                    onChange={(e) => setNewPosition({ ...newPosition, shares: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Target Price (Optional)</Label>
                  <Input
                    type="number"
                    placeholder="5000"
                    value={newPosition.targetPrice}
                    onChange={(e) => setNewPosition({ ...newPosition, targetPrice: e.target.value })}
                    className="font-mono"
                  />
                </div>
                <div>
                  <Label>Stop Loss (Optional)</Label>
                  <Input
                    type="number"
                    placeholder="4200"
                    value={newPosition.stopLoss}
                    onChange={(e) => setNewPosition({ ...newPosition, stopLoss: e.target.value })}
                    className="font-mono"
                  />
                </div>
              </div>
              <div>
                <Label>Notes (Optional)</Label>
                <Input
                  placeholder="Entry reason..."
                  value={newPosition.notes}
                  onChange={(e) => setNewPosition({ ...newPosition, notes: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <Button variant="outline" onClick={() => setShowAddPosition(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleAddPosition} className="flex-1">
                Add Position
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}