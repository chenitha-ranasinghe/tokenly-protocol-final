'use client';
import { useEffect, useState } from 'react';
import styles from './TradeFeed.module.css';

interface Trade {
  id: string;
  alias: string;
  type: 'buy' | 'sell';
  shares: number;
  live_price: number;
  product: string;
  time: string;
  image_url?: string;
}

export default function TradeFeed() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [stats, setStats] = useState({ trade_count: 0, volume: 0, active_traders: 0 });

  const fetchFeed = async () => {
    try {
      const res = await fetch('/api/feed');
      const data = await res.json();
      if (data.success) {
        setTrades(data.trades);
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Feed error:', err);
    }
  };

  useEffect(() => {
    fetchFeed();
    const interval = setInterval(fetchFeed, 30000); // 30s refresh
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.pulse} />
        <span className={styles.title}>Live Institutional Feed</span>
        <div className={styles.stats}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>24H VOL</span>
            <span className={styles.statVal}>${(stats.volume || 0).toLocaleString()}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>TRADES</span>
            <span className={styles.statVal}>{(stats.trade_count || 0).toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className={styles.scrollArea}>
        {trades.map(t => (
          <div key={t.id} className={styles.tradeRow}>
            <div className={styles.time}>{new Date(t.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            <div className={styles.alias}>{t.alias}</div>
            {t.image_url && (
              <div className={styles.thumbnail}>
                <img src={t.image_url} alt={t.product} />
              </div>
            )}
            <div className={t.type === 'buy' ? styles.buy : styles.sell}>
              {t.type.toUpperCase()}
            </div>
            <div className={styles.details}>
              {t.shares} shares of <span className={styles.product}>{t.product}</span> @ ${(t.live_price || 0).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
