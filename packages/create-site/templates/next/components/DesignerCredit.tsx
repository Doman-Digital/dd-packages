// The designer credit. Written by @domandigital/create-site.
//
// Brand name as the link text, the homepage as the target, rel="nofollow".
// Google's link spam policy lists "widely distributed links in the footers
// or templates of various sites", and a studio credit on every client site
// is that pattern. The credit is never a contract term and never tied to a
// discount. Doman Digital decision, 24 September 2026: do not change the
// text, the href or the rel.

export function DesignerCredit({ className }: { className?: string }) {
  return (
    <a className={className} href="https://domandigital.co.uk/" rel="nofollow">
      Website by Doman Digital
    </a>
  );
}
