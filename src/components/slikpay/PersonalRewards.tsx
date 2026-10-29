import { useState, useEffect } from "react";
import { 
  Award, Check, Copy, ExternalLink, Gift, 
  MessageCircle, QrCode, Share2, Sparkles, 
  TrendingUp, Users, Wallet, Zap 
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { naira } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export function PersonalRewards() {
  const { user } = useAuth();

  const referralCode = user?.name 
    ? `SLK-${user.name.split(" ")[0].toUpperCase()}-${(user.email || "99").slice(0, 3).toUpperCase()}`
    : "SLK-FRIEND-772";

  const shareUrl = `https://slikpay.online/join?ref=${referralCode}`;

  const [cashbackBalance, setCashbackBalance] = useState(8450);
  const [totalReferralEarned, setTotalReferralEarned] = useState(12500);
  const [friendsJoined, setFriendsJoined] = useState(25);
  const [claiming, setClaiming] = useState(false);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(referralCode);
      toast.success("Referral code copied!", { description: referralCode });
    } catch {
      toast.error("Unable to copy to clipboard");
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Share invite link copied!", { description: shareUrl });
    } catch {
      toast.error("Unable to copy to clipboard");
    }
  };

  const handleClaimCashback = () => {
    if (cashbackBalance <= 0) {
      toast.info("No cashback balance to claim right now.");
      return;
    }
    setClaiming(true);
    setTimeout(() => {
      const claimed = cashbackBalance;
      setCashbackBalance(0);
      setClaiming(false);
      toast.success(`Claimed ${naira(claimed)} directly to your Main Wallet!`, {
        description: "Funds are immediately available for spending, transfers, or airtime.",
      });
    }, 600);
  };

  const handleShareWhatsApp = () => {
    const text = `Hey! Sign up on Slikpay with my code ${referralCode} and get instant ₦500 bonus + zero transfer fees: ${shareUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-black tracking-tight text-foreground sm:text-2xl flex items-center gap-2">
            <Gift className="h-6 w-6 text-magenta" />
            Rewards, Cashback & Referral Hub
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Earn ₦500 for every friend who joins Slikpay, plus up to 2% instant cashback on all bill payments and card purchases.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-magenta/30 bg-magenta/10 px-3 py-2 text-xs font-bold text-magenta">
          <Award className="h-4 w-4" />
          Ambassador Status: Silver Tier
        </div>
      </div>

      {/* Metric Tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {/* Cashback Balance with Claim Button */}
        <div className="rounded-xl border border-cyan/40 bg-card p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Unclaimed Cashback</span>
            <Wallet className="h-4 w-4 text-cyan" />
          </div>
          <p className="mt-2 text-2xl font-black text-cyan">{naira(cashbackBalance)}</p>
          <Button
            size="sm"
            disabled={claiming || cashbackBalance <= 0}
            onClick={handleClaimCashback}
            className="mt-3 w-full bg-cyan text-slate-950 font-bold hover:bg-cyan/90 text-xs h-8"
          >
            {claiming ? "Transferring..." : "Claim to Wallet"}
          </Button>
        </div>

        {/* Total Referral Bonus Earned */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Referral Earnings</span>
            <Sparkles className="h-4 w-4 text-magenta" />
          </div>
          <p className="mt-2 text-2xl font-black text-foreground">{naira(totalReferralEarned)}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Paid out directly to wallet</p>
        </div>

        {/* Friends Onboarded */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Friends Joined</span>
            <Users className="h-4 w-4 text-cobalt" />
          </div>
          <p className="mt-2 text-2xl font-black text-cobalt">{friendsJoined}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Verified Tier 1 users</p>
        </div>

        {/* Active Cashback Rate */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Cashback Rate</span>
            <TrendingUp className="h-4 w-4 text-success" />
          </div>
          <p className="mt-2 text-2xl font-black text-success">1.5%</p>
          <p className="mt-1 text-[11px] text-muted-foreground">On bills, airtime & cards</p>
        </div>
      </div>

      {/* Referral Invite Card */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
          <Share2 className="h-5 w-5 text-cyan" />
          Your Unique Referral Link & Code
        </h2>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
          Share your personal link with friends, family, or business partners. When they register and verify their account, both of you receive instant cash rewards.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {/* Code Box */}
          <div className="rounded-xl border border-border bg-background/50 p-4">
            <span className="text-xs font-bold text-muted-foreground">Referral Code</span>
            <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-2.5">
              <span className="font-mono text-base font-black text-cyan">{referralCode}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyCode}
                className="h-8 gap-1.5 text-xs font-bold text-foreground hover:text-cyan"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy
              </Button>
            </div>
          </div>

          {/* Link Box */}
          <div className="rounded-xl border border-border bg-background/50 p-4">
            <span className="text-xs font-bold text-muted-foreground">Full Direct Web Link</span>
            <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-2.5">
              <span className="truncate font-mono text-xs text-muted-foreground">{shareUrl}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyLink}
                className="h-8 shrink-0 gap-1.5 text-xs font-bold text-foreground hover:text-cyan"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy Link
              </Button>
            </div>
          </div>
        </div>

        {/* Action Share Buttons */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            onClick={handleShareWhatsApp}
            className="bg-[#25D366] text-white hover:bg-[#25D366]/90 font-bold text-xs"
          >
            <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
            Share via WhatsApp
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const text = `Join Slikpay for free, instant payments & zero bank fees. Sign up here: ${shareUrl}`;
              window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank");
            }}
            className="text-xs font-bold"
          >
            Share on X (Twitter)
          </Button>
        </div>
      </div>

      {/* Ambassador Ladder Progression */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
          <Award className="h-5 w-5 text-cobalt" />
          Ambassador Tier Milestones
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Unlock higher reward multipliers and VIP perks as your network grows on Slikpay.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Bronze */}
          <div className="rounded-xl border border-border bg-background/40 p-4 space-y-2 opacity-80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground">Tier 1</span>
              <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                0 - 5 Friends
              </span>
            </div>
            <h3 className="font-extrabold text-foreground">Bronze</h3>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• ₦500 per friend</li>
              <li>• 1.0% Bill Cashback</li>
              <li>• Standard Transfer Rates</li>
            </ul>
          </div>

          {/* Silver */}
          <div className="rounded-xl border border-cyan bg-cyan/5 p-4 space-y-2 relative">
            <span className="absolute -top-2.5 right-3 rounded-full bg-cyan px-2 py-0.5 text-[10px] font-black text-slate-950">
              CURRENT TIER
            </span>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-cyan">Tier 2</span>
              <span className="rounded bg-cyan/20 px-2 py-0.5 text-[10px] font-bold text-cyan">
                6 - 20 Friends
              </span>
            </div>
            <h3 className="font-extrabold text-foreground">Silver</h3>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• ₦750 per friend</li>
              <li>• 1.5% Bill Cashback</li>
              <li>• Free USD Virtual Card</li>
            </ul>
          </div>

          {/* Gold */}
          <div className="rounded-xl border border-border bg-background/40 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground">Tier 3</span>
              <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                21 - 50 Friends
              </span>
            </div>
            <h3 className="font-extrabold text-foreground">Gold</h3>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• ₦1,000 per friend</li>
              <li>• 2.0% Bill Cashback</li>
              <li>• Free Physical Metal Card</li>
            </ul>
          </div>

          {/* Platinum */}
          <div className="rounded-xl border border-border bg-background/40 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground">Tier 4</span>
              <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                50+ Friends
              </span>
            </div>
            <h3 className="font-extrabold text-foreground">Platinum</h3>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• ₦1,500 per friend</li>
              <li>• Zero NIP Transfer Fees</li>
              <li>• Dedicated VIP Account Manager</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Recent Rewards History */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-base font-extrabold text-foreground">Recent Cashback & Referral Activity</h2>
        <div className="mt-4 divide-y divide-border text-xs">
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-bold text-foreground">Referral Bonus: Fatima Aliu</p>
              <p className="text-muted-foreground">Friend registered & completed Tier 1 KYC</p>
            </div>
            <span className="font-black text-success">+₦500.00</span>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-bold text-foreground">1.5% Electricity Bill Cashback</p>
              <p className="text-muted-foreground">IKEDC Prepaid Token ₦20,000 Recharge</p>
            </div>
            <span className="font-black text-cyan">+₦300.00</span>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-bold text-foreground">Referral Bonus: Kenechukwu Obi</p>
              <p className="text-muted-foreground">Friend activated virtual card</p>
            </div>
            <span className="font-black text-success">+₦500.00</span>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-bold text-foreground">1.5% MTN Airtime Cashback</p>
              <p className="text-muted-foreground">₦10,000 VTU Top Up</p>
            </div>
            <span className="font-black text-cyan">+₦150.00</span>
          </div>
        </div>
      </div>
    </div>
  );
}
