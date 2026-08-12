# Product Requirements Document — Dalal, Live Auction Platform

| Field | Value |
|---|---|
| Document | Dalal — Live Auction Platform, MVP PRD |
| Version | **3.0 (Final — all product decisions closed)** |
| Date | 2026-08-12 |
| Owner | Product Management |
| Status | **Finalized** — **all fifteen product decisions closed. Zero unresolved product questions** (§21) |
| Audience | 3-person development team, QA, stakeholders |
| **Platform** | **Responsive web application (website).** Desktop and mobile **browsers**. **Not** a native mobile app — see §1.1 |
| Currency | **Saudi Riyal (SAR)** — all displayed values are **simulated demonstration values** |
| Financial scope | **Dalal does not process real money.** No payments, no settlement — see §19.0 |
| Next phase | Architecture → task breakdown → implementation |

> ### ⚠ Financial Scope — read before any other section
>
> **Dalal is a demonstration/educational MVP.** Auction prices are displayed in **Saudi Riyal (SAR)** so the experience feels realistic — for example `Starting Price: 100 SAR`, `Current Bid: 250 SAR`, `Winning Bid: 400 SAR`.
>
> **These are simulated values only. No real money moves at any point.** There is no payment processing, no checkout, no card handling, no payment gateway, no wallet, no bank transfer, no refund, no financial settlement, no shipping, and no order fulfillment. The product ends at **winner determination and result display**.
>
> SAR is used purely as a realistic unit of price representation.

---

## 1. Product Overview

Dalal is a web-based product that lets any registered user publish an item as a timed auction, and lets other registered users compete for that item by placing bids in real time. It is built as a **demonstration/educational MVP**: the auction mechanics are complete and correct, but no real money is involved (§19.0).

### 1.1 Platform statement

> **Dalal is a responsive web-based live auction platform. The MVP is accessed through web browsers and deployed on Vercel. Native mobile applications are out of scope for the MVP.**

| In scope | Out of scope |
|---|---|
| Desktop web browsers | Flutter application |
| Mobile web browsers | Android native application |
| Responsive web design | iOS native application |
| Browser-based authentication | App Store distribution |
| Browser-based auction experience | Google Play distribution |
| Responsive auction pages | Native mobile architecture |
| Vercel deployment | Mobile app builds |

**"Mobile responsive" means the website must work well on a mobile browser** (NFR-USA-06, SC-49). It does **not** mean a mobile application is being built. Every requirement in this document describes behavior in a browser. There is no app shell, no store submission, no device build, and no native platform code anywhere in the MVP.

The defining characteristic of the product is **live price movement**. When any bidder places a valid bid, every other person currently viewing that auction sees the new price, the new leading bidder, and the updated bid history appear on their screen within a couple of seconds, without refreshing or clicking anything. That shared, simultaneous experience is what separates an auction from a listing site, and it is the core of the MVP.

The MVP delivers one complete, trustworthy loop:

> create an auction → other users discover it → they bid against each other live → the clock runs out → the system closes the auction and names a single, correct winner at a single, correct final price in SAR.

**The MVP stops at winner determination and result display.** There is no post-auction workflow of any kind: no payment, no contact exchange, no messaging, no shipping, no fulfillment. When an auction ends, the system displays the outcome to the winner, the seller, and every other viewer — and that is the end of the product's responsibility.

Two properties are treated as non-negotiable quality bars for the MVP:

1. **Correctness of price and outcome.** The current price, the bid history, and the declared winner must be right, always, including when many people bid at the same instant. A demo that looks fast but occasionally shows the wrong winner is a failed MVP. This matters even though the SAR values are simulated — the point of the demonstration is that the mechanics are correct.
2. **The server is the only authority.** No bid is valid because the browser said so. Every bid is accepted or rejected by server-side validation, and the client is purely a display and input surface.

---

## 2. Problem Statement

**For sellers.** A person with a single item to sell (a used phone, a collectible, a piece of equipment) has two poor options. Fixed-price marketplaces force them to guess the right price — too high and it sits unsold, too low and they leave money behind — and then absorb a long tail of haggling messages. Established auction sites solve the price-discovery problem but impose account friction, listing fees, category rules, and long listing cycles that are disproportionate for one item.

**For buyers.** On fixed-price listings there is no transparency about competing demand and no mechanism to signal "I would pay more than the person ahead of me." On slower auction sites, the experience is asynchronous and stale: a buyer checks a page, sees a price, and has no idea whether that number is current or ten minutes old. They must manually refresh to find out they were outbid, and often discover it too late to respond.

**The shared gap.** Both sides lack a *live, shared, trustworthy* price signal. The specific failures the MVP targets:

| Problem | Consequence today | What the MVP does |
|---|---|---|
| Stale prices requiring manual refresh | Buyers bid against outdated information; bids get rejected as "too low" | Price and history push to all viewers automatically |
| No visibility into competing demand | Buyers disengage; sellers get less than the item is worth | Live bid history makes competition visible |
| Client-side or weakly-validated bidding | Prices can be manipulated; outcomes are disputable | All bid validation is server-side and authoritative |
| Ambiguous auction endings | Disputes over who won and at what price | A deterministic close: one winner, one final price, permanently recorded |
| Heavy setup to list one item | Casual sellers never list at all | Create an auction in one short form: image, name, description, starting price, end time |

**Why now / why this shape.** Real-time data delivery to browsers is now a commodity capability rather than a specialist build, so a small team can deliver a genuinely live auction experience. The constraint that shapes this PRD is the team: **three developers**. The scope below is drawn tightly around the single loop above so the team can build it well — correct under concurrency, secure against client tampering, and reliable at auction close — rather than building a broad marketplace shallowly.

### 2.1 How the demonstration scope changes the problem

Dalal is an educational MVP, so the problem it actually solves is narrower than the market problem described above. The market problem is the *context* that makes the product coherent; the problem the MVP *solves* is:

> **Demonstrate, end to end and correctly, how a real-time auction platform works** — from authentication and auction creation, through live concurrent bidding and server-side validation, to automatic expiration, winner determination, and result display.

Two consequences follow, and they apply throughout this document:

- **Prices are simulated.** Auctions are priced in SAR to make the experience realistic, but no value changes hands. The commercial half of the market problem — buyers paying sellers, goods being delivered — is deliberately not addressed (§19.0).
- **Correctness is still the bar.** Simulated money does not mean approximate mechanics. A demonstration whose price is occasionally wrong, whose winner is occasionally wrong, or whose rules can be bypassed from the client has demonstrated nothing worth demonstrating.

---

## 3. Product Vision

**Vision statement**

> Dalal demonstrates how a real-time auction platform works — from authentication and auction creation, through live bidding, to auction expiration and winner determination — with every rule enforced correctly by the server.

**What Dalal sets out to demonstrate**

The MVP is complete when all eleven of these are working end to end:

| # | Capability | Where it is specified |
|---|---|---|
| 1 | **Authentication** — register, log in, log out, session, password reset | §8.1 |
| 2 | **User profiles** — the minimal identity needed to attribute bids | §8.2 |
| 3 | **Auction creation** — publish an item with a starting price in SAR and an end time | §8.3 |
| 4 | **Product image storage** — upload and display one image per auction | §8.3 |
| 5 | **Auction browsing** — discover and evaluate open auctions | §8.4, §8.5 |
| 6 | **Real-time bidding** — place bids and see them land live | §8.6, §8.7 |
| 7 | **Server-side bid validation** — every rule enforced by the server, never the client | §8.6, §9, §14.3 |
| 8 | **Concurrent bid handling** — simultaneous bids resolved to one definitive order | BR-11, BR-12 |
| 9 | **Auction expiration** — automatic close at the end time, with no human action | §8.8 |
| 10 | **Winner determination** — the highest valid bid wins, recorded permanently | §8.8 |
| 11 | **Result display** — the outcome shown to winner, seller, and every viewer | §8.8, §11 |

Nothing beyond these eleven is MVP. The product ends at item 11.

**The experience we are aiming for**

Opening an auction should feel like standing in a saleroom, not reading a database record. The price is alive. When someone else bids, you see it happen. You know instantly whether you are still leading. The clock is visibly running down. When it hits zero, the room goes quiet and a winner is named — and nobody argues with the result, because the rules were enforced consistently for everyone by the server.

**Principles guiding MVP decisions**

1. **Trust over features.** A small set of behaviors that are provably correct beats a large set that are approximately correct. Where a trade-off arises between adding a capability and guaranteeing correct pricing/winner determination, correctness wins.
2. **The server is the referee.** The browser renders and requests; it never decides. Every rule in *Business Rules* is enforced server-side, and the UI is a convenience layer that mirrors those rules for a good experience — never a substitute for them.
3. **Liveness is the product.** Real-time updating is not a polish item to be deferred to a later sprint. An auction that requires a refresh has not met the product definition.
4. **Symmetry and fairness.** Every bidder sees the same information at the same time. No participant — including the seller — gets a privileged position, an early signal, or an exemption from the rules.
5. **Permanent, auditable history.** Bids are facts, not editable records. Once accepted, a bid is immutable and remains visible as part of the auction's public record, so any outcome can be explained after the fact.
6. **Minimum viable identity.** Users need only enough of an account to be uniquely and consistently attributable as a bidder, plus the ability to recover access if they forget their password. Profiles, reputation, and social identity are not part of this problem.
7. **The demonstration ends at the result.** Determining and displaying the winner is the finish line. The product does not carry the participants any further — no payment, no contact, no fulfillment (§19.0).

**Where this could go (direction, not commitment)**

Once the live loop is trustworthy, the natural extensions are: closing the commercial loop (payments, settlement, shipping), depth of auction mechanics (reserve prices, proxy/automatic bidding, anti-sniping time extension, buy-it-now), and reach (notifications, search and categories, mobile). These are recorded in *Future Enhancements* and are explicitly not MVP.

**How we will know the vision is being realized**

The MVP is directionally on track when a first-time seller completes a listing without assistance, two or more bidders compete on a single auction with updates appearing to all of them without a refresh, and the auction closes to a winner that all participants agree is correct. The measurable form of this is in *Success Criteria*.

---

## 4. Target Users

The platform serves one class of human — a registered individual — who moves between behaviors rather than belonging to fixed user types. The same person may sell one item today and bid on three others tomorrow. This is a deliberate product position: **roles are contextual, not assigned.**

### 4.1 Primary user personas

**Persona A — The Casual Seller ("Maya")**

| Attribute | Detail |
|---|---|
| Context | Has one or a few items to sell; not a business |
| Goal | Get a fair market price without haggling or long negotiation |
| Behavior | Photographs the item, writes a short description, sets a low-ish starting price to attract interest, sets an end time, then checks back periodically |
| Success looks like | Multiple bidders competed; the final SAR price met or exceeded expectations; the auction closed to a clear, unambiguous winner |
| Frustrations | Complicated listing forms; unclear rules; not knowing whether anyone is watching |
| MVP needs | A fast creation form, a clear view of her auction's activity, and an unambiguous result at the end |
| Out of scope for her | Getting paid, contacting the winner, shipping the item — the MVP shows her the result and stops (§19.0) |

**Persona B — The Active Bidder ("Omar")**

| Attribute | Detail |
|---|---|
| Context | Looking for a specific item or browsing for value |
| Goal | Win the item at the lowest price he has to pay, without being blindsided |
| Behavior | Browses listings, opens an auction, watches the price, places incremental bids, returns near the end time to contest |
| Success looks like | He can see the true current price at all times, knows immediately when he is outbid, and is confident the ending is fair |
| Frustrations | Stale prices; rejected bids because the page was out of date; losing without knowing why |
| MVP needs | Live price and bid history, instant feedback on whether his bid was accepted, a visible countdown, clear leading/outbid status |

**Persona C — The Observer ("Layla")**

| Attribute | Detail |
|---|---|
| Context | Interested but not committed; may be deciding whether to enter |
| Goal | Understand whether the item is worth pursuing and how competitive it is |
| Behavior | Opens the auction, watches the price move, may convert into a bidder |
| Success looks like | She can evaluate demand without an account, then register at the moment she decides to bid |
| MVP needs | Public read access to listings and auction detail, with a clear prompt to sign in at the point of bidding |

*Note: the Observer is a browsing behavior, not a separate account type. Unauthenticated visitors can view the listing, auction detail, and bid history — all of it is public (FR-AUTH-23, BR-40).*

### 4.2 Explicitly not target users for the MVP

| Not targeted | Reason |
|---|---|
| High-volume / professional sellers | Need bulk listing, inventory tools, and fee handling — all out of scope |
| Business buyers / procurement | Need invoicing, purchase orders, tax handling — out of scope |
| Anonymous / guest bidders | Every bid must be attributable to an authenticated identity (see *Business Rules* BR-01) |
| Users requiring a native mobile app | Dalal is a website (§1.1). Mobile users are served by a responsive web interface in their mobile browser |
| Non-English-speaking users as a served segment | Multi-language support is out of scope |

### 4.3 Is a dedicated Admin role required for the MVP?

**Determination: No. An in-product Admin role is NOT required for the MVP and must not be built.**

Reasoning:

- **No MVP feature depends on it.** Every capability in *MVP Scope → Must Have* is performed by the two user behaviors (create auction, place bid). Nothing in the core loop requires an operator to intervene for the loop to complete correctly.
- **The obvious admin use cases are themselves out of scope.** Content moderation, dispute resolution, refunds, and user suspension all relate to payments, trust-and-safety, and marketplace operations — none of which the MVP performs.
- **Auction closing is automatic, not operated.** The system closes auctions and determines winners on its own (see *Auction Lifecycle*). There is no "admin closes the auction" step to support.
- **An admin role is a security liability disproportionate to its value.** A privileged role that can read or modify any auction expands the authorization surface the team must design, enforce, and test, in a product whose central promise is that nobody can bypass the bidding rules. Building it "just in case" directly conflicts with Principle 2 and Principle 4 in §3.
- **Cost to the 3-person team.** An admin surface implies its own screens, its own permission layer, and its own test matrix — real work with no MVP user story behind it.

**What replaces it for the MVP:** operational needs (investigating a reported listing, correcting bad data, taking down abusive content) are handled **out-of-band** by a developer or operator with direct data access, as a manual, logged, human process. This is acceptable at MVP scale (low volume, small trusted team) and is explicitly a temporary position.

**Trigger to revisit:** an Admin role becomes required as soon as any one of these is true — the platform accepts public sign-ups at a volume where manual moderation is impractical, payments are introduced (creating disputes and refunds), or a legal/compliance obligation requires audited takedown capability. **None of these applies to a demonstration MVP with simulated SAR values and no payments**, which is why the decision is straightforward here. Any administrative capability belongs to *Future Enhancements* (§22.4), never to this MVP.

**Accepted operational gap:** with no Admin role, no auction cancellation (§9, BR-30), and no auction editing (BR-31), there is no in-product route to remove an abusive or mistaken listing. At demonstration scale this is handled out-of-band by a developer with direct data access, as a manual process. This is a recorded, accepted limitation — not an open question.

---

## 5. Product Goals

### 5.1 Primary MVP goals

Each goal states the outcome, why it matters, and how we know it was met. Measurable targets are consolidated in *Success Criteria* (§18).

**G1 — A seller can publish a live auction quickly and without confusion.**
A user with one item can go from "I want to sell this" to a live, publicly visible auction in a single short form: image, name, description, starting price in SAR, end time. *Why it matters:* if listing is slow or unclear, there is no supply and nothing to bid on. *Met when:* a first-time seller completes creation unaided, and the auction appears in the public listing immediately. Once published, the auction is immutable — it cannot be edited or cancelled (BR-30, BR-31).

**G2 — Any user can discover and evaluate open auctions.**
Users can browse available auctions and see enough per item — image, name, current price, time remaining, status — to decide what to open. *Why it matters:* demand only forms where auctions are findable. *Met when:* a browsing user can identify open auctions and reach a detail page in one click.

**G3 — Authenticated users can place bids that are validated by the server.**
A bid is accepted only if the auction is open, the bidder is authenticated, the bidder is not the seller, and the amount meets the minimum acceptable bid — **equal to or above the starting price for the first bid, strictly above the current price for every bid after it** (BR-28). Rejections give a clear reason. *Why it matters:* this is the platform's core transaction and its core trust promise. *Met when:* every rule in *Business Rules* is enforced server-side and every invalid bid is rejected with an explanatory message.

**G4 — Everyone viewing an auction sees the same live state.**
When a bid is accepted, all current viewers see the new price, the new leading bidder, and the new history entry appear automatically, within seconds, with no refresh. *Why it matters:* this is the product's defining characteristic (§3, Principle 3). *Met when:* two browsers on the same auction converge on the same displayed state after a bid, unaided.

**G5 — Auctions end automatically and correctly.**
At the end time, bidding stops, the auction is marked ended, the highest valid bid determines the winner, and the final price is recorded permanently. *Why it matters:* an auction that does not reliably close has no outcome and no value. *Met when:* bids after the end time are always rejected, and the declared winner matches the highest valid bid in history for every closed auction.

**G6 — The outcome is transparent and permanent to all parties.**
After close, the seller sees who won and at what price; the winner sees that they won; other participants see the auction ended and who won. Bid history remains intact and immutable. *Why it matters:* a disputable outcome destroys trust in every future auction. *Met when:* all three viewpoints render correctly from the same recorded result.

**G7 — Identity and access control are sufficient to attribute and protect every action.**
Registration, login, logout, and persistent session; every bid tied to a real user; users cannot act on resources they do not own. *Why it matters:* attribution is a precondition for bidding at all (BR-01), and authorization is what stops the rules from being bypassed. *Met when:* unauthenticated bid attempts are rejected and no user can modify another user's auction or any bid.

**G8 — The system behaves correctly when users act at the same time.**
Concurrent bids on the same auction resolve to a single deterministic order; exactly one bid at any given price level is accepted; no bid is lost or double-counted. *Why it matters:* auctions are contested precisely at the moments when concurrency is highest. *Met when:* under simultaneous bidding, history shows a strictly increasing price sequence with no duplicates or gaps in ordering.

### 5.2 Secondary goals (pursued only if they do not risk the primary goals)

- **G9 — Graceful degradation of liveness.** If the real-time connection drops, the user is told, and current state is recovered on reconnect. Liveness may degrade; correctness may not.
- **G10 — Task-partitionable product surface.** Requirements are grouped along natural seams — identity, auction creation and media, browsing and detail, bidding and validation, real-time delivery, closing and results — so three developers can work in parallel with minimal blocking. *(This shapes how requirements are written; it does not assign work.)*

### 5.3 Explicit non-goals for the MVP

| Non-goal | Rationale |
|---|---|
| Completing any commercial transaction | Dalal processes no real money. Payments, checkout, settlement, shipping, and fulfillment are all out of scope; the MVP ends at winner determination and result display (§19.0) |
| Connecting the seller and the winner | No chat, messaging, or contact exchange. The system displays the result and stops |
| Maximizing final sale prices | No proxy bidding, reserve prices, or anti-sniping mechanics in v1 |
| Growth, engagement, or retention mechanics | No notifications-driven re-engagement, recommendations, or social features |
| Marketplace-scale operations | No admin tooling, moderation queues, or analytics dashboards |
| Handling hostile load | Correct behavior for realistic small-scale concurrent use, not adversarial traffic |

---

## 6. User Roles

Roles are **contextual capabilities**, not account types. There is exactly one account type — a registered user — and the same account holds different capabilities depending on its relationship to a given auction.

### 6.1 Role definitions

**R1 — Visitor (unauthenticated)**
Anyone who has not signed in.

- **Can:** view the auction listing; open an auction detail page; see product info, image, current price, status, time remaining, and bid history; register; log in.
- **Cannot:** create an auction; place a bid; see any private information.
- **At the point of bidding:** the bid control is visible but prompts sign-in rather than being silently hidden, so the path to participating is obvious.

**R2 — Registered User (authenticated)**
Any signed-in account. This is the base role; every capability below builds on it.

- **Can:** everything a Visitor can; create auctions; place bids on auctions they do not own; view their own auctions and their own bidding activity; log out; reset their password if they forget it (FR-AUTH-25 → 30).
- **Cannot:** act on another user's auction; modify or delete any bid, including their own.

**R3 — Auction Creator / Seller (contextual, per auction)**
A Registered User in relation to an auction they created.

- **Can:** create the auction; view it, including its full bid history and, after close, the winner's identity and final price.
- **Cannot:** **bid on their own auction** (BR-02); alter the current price; alter or delete bid history; alter the outcome; **edit the auction after publishing** (BR-31); **cancel the auction** (BR-30); close, extend, or reopen the auction.
- **Note:** the seller has no informational advantage during the auction. They see the same live state as everyone else. Once published, an auction is entirely out of the seller's control — it runs to its end time and closes automatically.

**R4 — Bidder (contextual, per auction)**
A Registered User who is not the seller of that auction, in relation to an auction they may bid on.

- **Can:** place bids that satisfy all validation rules; see whether they are currently the leading bidder; see full bid history; after close, see whether they won.
- **Cannot:** bid on an auction they created; bid on a non-active auction; place a bid below the minimum acceptable bid (BR-28); retract, edit, or delete a placed bid.

**R5 — Winner (contextual, terminal)**
The bidder holding the highest valid bid at the moment an auction closes. Assigned by the system, never claimed.

- **Can:** see a clear indication on the auction that they won, and the final winning bid in SAR.
- **Cannot:** change, decline, or transfer the result. There is nothing for the winner to *do* after winning — no payment, no contact with the seller, no collection. **Winning is the end of the flow** (§19.0).

**R6 — Administrator — NOT IMPLEMENTED IN MVP**
See §4.3 for the full determination and the conditions that would trigger building it. Operational intervention is handled out-of-band by the development team.

### 6.2 Capability matrix

| Capability | Visitor | Registered User | Seller (own auction) | Bidder (other's auction) |
|---|---|---|---|---|
| Browse auction listing | Yes | Yes | Yes | Yes |
| View auction detail & bid history | Yes | Yes | Yes | Yes |
| Register / log in | Yes | — | — | — |
| Request a password reset | Yes | Yes | Yes | Yes |
| Log out | No | Yes | Yes | Yes |
| Create an auction | No | Yes | — | — |
| Upload a product image | No | Yes (own auction only) | Yes | No |
| Place a bid | No | Yes (non-owned auctions) | **No** | Yes |
| See own leading/outbid status | No | Yes | n/a | Yes |
| See winner after close | Yes | Yes | Yes | Yes |
| **Edit own auction after publishing** | No | No | **No** (BR-31) | n/a |
| **Cancel own auction** | No | No | **No** (BR-30) | n/a |
| Edit/delete another user's auction | No | No | n/a | No |
| Edit/delete any bid | No | No | No | No |
| Change current price directly | No | No | No | No |
| Close an auction manually | No | No | **No** (system-driven) | No |
| Contact the seller or the winner | No | No | **No** (not in the product) | No |

### 6.3 Role rules

- **RR-01** A single account can simultaneously be a Seller on one auction and a Bidder on another. Capabilities are evaluated per auction, never globally.
- **RR-02** Seller and Bidder are **mutually exclusive on the same auction**. This is enforced server-side on every bid attempt (BR-02).
- **RR-03** Role capability is derived from stored ownership and authenticated identity on each request. It is never taken from client-supplied input.
- **RR-04** No role in the MVP can mutate bid history or a recorded outcome. Bid records are append-only and immutable (BR-05).
- **RR-05** Winner is assigned by the system at close from the recorded bid history. It is not a claimable or grantable status.

---

## 7. MVP Scope

Ordered by priority within each tier. "Must Have" is the release gate: the MVP does not ship until every Must Have item is complete and verified.

### 7.1 Must Have — required for the core auction experience

| # | Item | Description | Why it is required |
|---|---|---|---|
| M1 | User registration | Create an account with credentials sufficient to establish a unique identity | No bidding without attributable identity (BR-01) |
| M2 | User login / logout | Sign in, sign out, and a session that persists across page loads | Bidding and creating require an authenticated session |
| M3 | Authentication state in UI | Every page reflects whether the viewer is signed in and who they are | Users must know their identity before committing to a bid |
| M4 | Minimal user profile | A display identifier used to attribute bids and identify the winner | Bid history and results must name a participant |
| M5 | Auction creation | Form capturing image, name, description, starting price in SAR, end time; validated server-side; auction becomes Active on publish and is thereafter immutable | The supply side of the marketplace (G1) |
| M6 | Product image upload | Upload one image per auction, stored and displayed on listing and detail | Explicitly required; buyers will not bid on an unseen item |
| M7 | Auction listing page | Browsable list of auctions showing image, name, current price, status, time remaining | Discovery (G2) |
| M8 | Auction detail page | Full product info, image, current price, status, countdown, bid history, seller identity, bid control | The primary surface of the product |
| M9 | Bid placement | Authenticated, non-owner users submit a bid amount and receive accept/reject feedback | The core transaction (G3) |
| M10 | Server-side bid validation | Every rule in *Business Rules* enforced on the server for every bid | The core trust guarantee (§3, Principle 2) |
| M11 | Concurrency-safe bidding | Simultaneous bids resolve deterministically; exactly one wins each price level; none lost or duplicated | Correctness under contention (G8) |
| M12 | Immutable bid history | Accepted bids are permanent, append-only, and visible on the auction | Auditability and dispute resolution (§3, Principle 5) |
| M13 | Real-time price updates | Current price updates for all current viewers without refresh | The defining characteristic (G4) |
| M14 | Real-time bid history updates | New bids appear in history for all current viewers without refresh | Same as above |
| M15 | Real-time status transition | Transition to Ended propagates to current viewers without refresh | Viewers must not keep bidding into a closed auction |
| M16 | Countdown / time remaining | Visible time remaining on listing and detail, updating continuously | Urgency and fairness; users must know how long they have |
| M17 | Automatic auction closing | At end time, bidding stops and the auction is marked Ended without human action | Auctions must close reliably (G5) |
| M18 | Winner determination | Highest valid bid at close determines the winner; final price recorded permanently | The outcome of the product (G5) |
| M19 | No-bid closure handling | An auction closing with zero bids ends with no winner and is displayed as such | Common case; must not error or hang |
| M20 | Result views | Seller sees winner and final price; winner sees they won; others see ended + winner | Transparency to all parties (G6) |
| M21 | Authorization enforcement | Users cannot act on resources they do not own; all sensitive operations validated server-side | Security baseline (G7, §14) |
| M22 | Bid rejection feedback | Every rejected bid returns a specific, human-readable reason | Users cannot participate fairly without knowing why they failed |
| M23 | Realtime connection status & recovery | User is told when live updates are unavailable; full current state is recovered on reconnect | Correctness must survive a dropped connection (G9) |
| **M24** | **Password reset** | A user who forgets their password can recover access to their account through a self-service flow | Without it, a forgotten password permanently strands the user — and with no Admin role (§4.3), nobody can help them |

### 7.2 Should Have — valuable, built only if Must Have is complete and stable

| # | Item | Description | Why not Must Have |
|---|---|---|---|
| S1 | "My Auctions" view | List of auctions the user created, with status and current price | Useful, but the seller can reach their auctions via the listing |
| S2 | "My Bids" view | List of auctions the user has bid on, showing leading/outbid/won/lost | Convenience; the core loop works without it |
| S3 | Leading/outbid indicator | Persistent "You are the highest bidder" / "You have been outbid" state on the auction | Derivable by the user from history + their identity; strong UX win if time permits |
| ~~S4~~ | ~~Minimum bid increment~~ | **Withdrawn — decided against (BR-32).** No increment exists in Dalal, now or as a Should Have. | Formerly dependent on Q4, now resolved |
| S5 | Suggested bid amount | Pre-fill the bid field with the minimum acceptable bid (the starting price when there are no bids; the smallest amount above the current price once there are) | Reduces invalid bids; purely convenience |
| S6 | Sorting / filtering the listing | e.g. newest first, price range. *(An "active only" filter is unnecessary — the listing is already active-only, FR-LIST-05)* | Valuable at volume; MVP volume is low |
| S7 | Image validation feedback | Clear client-side format/size guidance before upload | Server-side validation (M6) is the requirement; this is polish |
| S8 | Viewer count | "N people watching this auction" | Adds atmosphere; no correctness value |

### 7.3 Future — explicitly outside the MVP

Payment processing and settlement; checkout; shipping and fulfilment; reserve prices; proxy/automatic bidding; anti-sniping time extension; buy-it-now; **auction cancellation** (BR-30); **auction editing after publish** (BR-31); email/push notifications; **buyer–seller messaging or contact exchange**; ratings and reviews; categories, search, and recommendations; admin dashboards and moderation tooling; multi-language and multi-currency; native mobile applications; social sharing and following; advanced analytics; bulk listing tools; multi-image galleries and video.

See *Out of Scope* (§19) and *Future Enhancements* (§22) for detail and rationale.

### 7.4 Scope discipline rules

- **SD-01** No Should Have item begins until all Must Have items are complete and verified against *Success Criteria*.
- **SD-02** Any new request during implementation is evaluated against §5 Product Goals. If it does not serve a primary goal, it goes to Future by default.
- **SD-03** **All fifteen product decisions are closed** (§21.1). None may be reopened, reinterpreted, defaulted, or worked around during implementation. If a genuinely new ambiguity appears — something this document does not address at all — it must be raised with the team and recorded here as a decision, never invented in code (§21.3).
- **SD-04** Correctness Must Haves (M10, M11, M12, M17, M18, M21) are non-negotiable. If the schedule slips, scope is cut from Should Have and from breadth elsewhere — never from these.
- **SD-05** No implementer may introduce a price ceiling (BR-21), a bid increment (BR-32), an edit path (BR-31), a cancel path (BR-30), a `Cancelled` state, an Admin role (§4.3), or any payment/contact/shipping surface (§19.0). Each is an explicit product decision, not an oversight to be corrected in code.

---

## 8. Functional Requirements

Requirements are numbered `FR-<area>-<n>` and are written to be individually testable. "The system must" denotes a hard requirement; "should" denotes a strong preference that may be traded off with product sign-off.

### 8.1 Authentication

**Registration**

- **FR-AUTH-01** The system must let an unauthenticated visitor create an account by providing an email address and a password.
- **FR-AUTH-02** Email addresses must be unique across accounts. Attempting to register an already-registered email must fail with a clear message and must not reveal anything further about the existing account.
- **FR-AUTH-03** The system must validate email format and reject malformed addresses before creating an account.
- **FR-AUTH-04** Passwords must meet a minimum strength rule of at least 8 characters. The rule must be stated on the form before submission, and violations rejected with a specific message.
- **FR-AUTH-05** Registration must be validated server-side. Client-side validation is a convenience only and must never be the sole gate.
- **FR-AUTH-06** On successful registration, the user must be authenticated immediately and taken to the auction listing without a separate login step.
- **FR-AUTH-07** **Email verification is not required.** A user may register and immediately use every part of the platform — browsing, creating auctions, and bidding — without confirming their email address. There is no verification step, no verification email, and no "unverified" account state *(decided; formerly Q8)*.
- **FR-AUTH-07a** **A valid email address is nonetheless required at registration**, because it is the account's identifier for login (FR-AUTH-08) and the sole channel for password reset (FR-AUTH-28). The address must pass format validation (FR-AUTH-03) and be unique (FR-AUTH-02).
- **FR-AUTH-07b** The registration form must make clear that the email address is used for account recovery, so a user understands why it must be one they can access. **A user who registers with an address they cannot receive mail at will be unable to reset a forgotten password** — this is an accepted consequence of not verifying (§20, A-T2).

**Login**

- **FR-AUTH-08** A registered user must be able to sign in with their email and password.
- **FR-AUTH-09** Failed login must produce a single generic failure message that does not disclose whether the email exists.
- **FR-AUTH-10** On success, an authenticated session must be established and the user returned to the page they were attempting to use, or to the listing if there was none.
- **FR-AUTH-11** If a user attempts to bid while unauthenticated, they must be prompted to sign in, and after signing in must be returned to that auction. Their bid amount is not carried over and must be re-entered deliberately.

**Logout**

- **FR-AUTH-12** An authenticated user must be able to log out from any page via a consistently placed control.
- **FR-AUTH-13** Logout must terminate the session such that subsequent requests are treated as unauthenticated.
- **FR-AUTH-14** After logout the user must land on a public page (the listing) and the UI must reflect the unauthenticated state everywhere.

**Authentication state**

- **FR-AUTH-15** Every page must clearly indicate whether the viewer is signed in and, if so, their identity.
- **FR-AUTH-16** The session must persist across page reloads and navigation, and across browser restarts within the session lifetime, without re-entering credentials.
- **FR-AUTH-17** When a session expires or becomes invalid, the user must be told clearly and prompted to sign in again, not left in a silently broken state.
- **FR-AUTH-18** If a session expires while the user is viewing an auction, viewing must continue to work (public data) and only the bid action requires re-authentication.

**User identity**

- **FR-AUTH-19** Every account must have a stable, unique internal identifier that never changes and is used to attribute all auctions and bids.
- **FR-AUTH-20** Every account must have a display identifier shown wherever the user appears publicly (bid history, seller, winner).
- **FR-AUTH-21** The display identifier must not be an email address, to avoid publishing contact details in public bid history.

**Access restrictions**

- **FR-AUTH-22** Creating an auction and placing a bid must require an authenticated session, verified server-side on every request.
- **FR-AUTH-23** Browsing the listing and viewing auction detail must not require authentication.
- **FR-AUTH-24** Client-side route protection is a UX affordance only. Every protected operation must be independently authorized server-side.

**Password reset** *(MVP — decided; formerly Q15)*

- **FR-AUTH-25** A user who cannot sign in must be able to start a password reset from the login screen, without needing to be authenticated.
- **FR-AUTH-26** The user must be able to initiate the reset by supplying the email address on their account.
- **FR-AUTH-27** The reset request must produce the **same confirmation message whether or not the email is registered**, so the flow does not disclose which addresses have accounts (consistent with FR-AUTH-09 and FR-SEC-16).
- **FR-AUTH-28** The reset must be delivered to the account's registered email address and must require possession of that mailbox to complete. It must not be possible to reset a password knowing only the email address.
- **FR-AUTH-29** A reset must expire after a limited period and must be usable only once. An expired or already-used reset must be rejected with a clear message and an option to request a new one.
- **FR-AUTH-30** On completing a reset, the new password must satisfy the same strength rule as registration (FR-AUTH-04), the user must be able to sign in with it immediately, and the old password must no longer work.
- **FR-AUTH-31** Password reset must not create, merge, or modify any account other than setting the new password on the existing account. It is an access-recovery flow, not an account-management surface.

> **Scope note:** password reset is the **only** transactional email in the MVP. It is not a notification feature and does not open the door to the notifications deferred in §16. See §16.5.

### 8.2 User Profile

- **FR-PROF-01** A profile must contain exactly: unique internal identifier, email (private, for authentication), display name (public), and account creation timestamp.
- **FR-PROF-02** A display name must be captured at registration or derived deterministically from the email local part if not supplied. Either way, every account must have one before it can bid.
- **FR-PROF-03** Display names must be 2–50 characters and **must be unique across all accounts** *(decided; formerly Q11)*. Uniqueness is validated server-side at registration, and a name already taken must be rejected with a clear, specific message that lets the user choose another.
- **FR-PROF-03a** Uniqueness exists so that public identity is unambiguous wherever a user appears: in bid history (FR-BID-23), as a seller (FR-DETAIL-13), and — most importantly — as the named winner in the seller's result view (FR-DETAIL-21). Two indistinguishable "Mohammed" entries would make the product's final output ambiguous.
- **FR-PROF-03b** The **internal identifier remains the source of truth** for all attribution and authorization. The display name is a unique human-readable label, never an authorization key.
- **FR-PROF-04** A user must be able to view their own profile information.
- **FR-PROF-05** Editing the display name is **Should Have**, not Must Have. If implemented, changes must not retroactively alter historical bid records' attribution to the correct account.
- **FR-PROF-06** Email addresses must never be exposed to other users anywhere in the product.
- **FR-PROF-07** The MVP must not include avatars, bios, locations, phone numbers, payment details, ratings, or public profile pages. **The seller and the winner are never given a way to contact each other** — there is no contact exchange, no messaging, and no post-auction workflow (§19.0). The profile exists solely to attribute bids and identify a winner.

### 8.3 Auction Creation

**Required fields**

- **FR-CREATE-01** Creating an auction must require all of: product image, product name, product description, starting price, auction end time.
- **FR-CREATE-02** The auction's owner is the authenticated user creating it, taken from the session and never from client input.

**Optional fields**

- **FR-CREATE-03** The MVP must not offer optional auction fields. Every field is required. **There is no reserve-price field** (BR-35); category and condition are Future.

**Validation rules** — all enforced server-side; the client should mirror them for fast feedback.

- **FR-CREATE-04** Product name: required, 3–100 characters after trimming whitespace.
- **FR-CREATE-05** Product description: required, 10–2000 characters after trimming.
- **FR-CREATE-06** Starting price: required, numeric, strictly greater than zero, expressed in **SAR**, with at most two decimal places.
- **FR-CREATE-07** **There is no maximum starting price in the MVP.** No price ceiling exists, and none may be introduced during implementation. *(Decided; formerly Q12. Rationale: SAR values are simulated with no financial consequence, so no product or business requirement justifies a ceiling. A developer must not invent one — see BR-21.)*
- **FR-CREATE-08** End time: required, a valid future timestamp, at least a defined minimum ahead of creation time.
- **FR-CREATE-09** **Minimum auction duration: 5 minutes** from creation *(decided; formerly Q5)*. Chosen so a full lifecycle — create, bid, close, see the winner — can be demonstrated and tested in a single sitting, which is a genuine requirement for a demonstration platform (PRD §2.1), not merely a testing convenience.
- **FR-CREATE-10** **Maximum auction duration: 7 days** from creation *(decided; formerly Q5)*. Bounds how long an auction stays open and, because auctions can be neither edited (BR-31) nor cancelled (BR-30), bounds how long a mistaken listing can remain live with no way to remove it.
- **FR-CREATE-10a** The permitted duration range is therefore **5 minutes to 7 days inclusive**, measured from creation time using server time (FR-CREATE-11). An end time outside this range must be rejected with a specific message naming the permitted range (BR-38).
- **FR-CREATE-11** Server-side validation must use server time, not client-supplied time, for all end-time checks.
- **FR-CREATE-12** If any field fails validation, the auction must not be created, and every failing field must be reported with a specific message in a single response. The user's entered values must be preserved.
- **FR-CREATE-13** The platform operates in a single currency: **Saudi Riyal (SAR)**. Every price — starting price, current price, bid amounts, final winning bid — must be displayed with a consistent `SAR` indicator, for example `100 SAR`, `250 SAR`, `400 SAR`. **All SAR values are simulated demonstration values; Dalal processes no real money** (§19.0). *(Decided; formerly Q12.)*
- **FR-CREATE-14** All timestamps must be stored and compared in a single canonical timezone (UTC) and displayed in the viewer's local timezone.

**Image requirements**

- **FR-CREATE-15** Exactly one image per auction in the MVP. Multiple images are Future.
- **FR-CREATE-16** Accepted formats: JPEG, PNG, WebP. Other types must be rejected with a clear message.
- **FR-CREATE-17** Maximum file size: 5 MB. Larger uploads must be rejected before the auction is created, with a clear message.
- **FR-CREATE-18** File type must be validated server-side, not by file extension alone.
- **FR-CREATE-19** If image upload fails, the auction must not be created in a partial state. The user must be told the upload failed and be able to retry without re-entering the other fields. See EC-08.
- **FR-CREATE-20** The stored image must be publicly readable so that any viewer, including unauthenticated visitors, can see it on the listing and detail pages.
- **FR-CREATE-21** A user may upload an image only in the context of creating their own auction. A user must not be able to attach an image to another user's auction.

**Ownership rules**

- **FR-CREATE-22** An auction has exactly one owner, permanently. Ownership cannot be transferred in the MVP.
- **FR-CREATE-23** The owner cannot bid on their own auction (BR-02), enforced server-side on every bid.
- **FR-CREATE-24** **A published auction cannot be edited.** Once created, the product name, product description, starting price, end time, and product image are **immutable** for the lifetime of the auction. No edit screen, no edit control, and no edit route may exist. *(Decided; formerly Q3. Rationale: changing the terms of a live auction is unfair to anyone who has already bid against those terms, and the alternative — conditional editing — adds seller-management complexity with no MVP value.)*
- **FR-CREATE-25** **An auction cannot be cancelled.** Once published, an auction runs to its end time and closes automatically. There is no cancel control, no cancellation rule, and **no `Cancelled` state** in the lifecycle (§12). *(Decided; formerly Q1. Rationale: a seller able to cancel after seeing a disappointing price would hold an informal reserve, undermining BR-06 and the fairness principle in §3.)*
- **FR-CREATE-26a** Because of FR-CREATE-24 and FR-CREATE-25, the creation form is the **only** opportunity to get an auction right. Validation feedback (FR-CREATE-12) and a clear review of the entered values before submission are therefore more important than they would be in a product with editing, and the double-submission case (EC-21) carries a permanent consequence.

**Publication**

- **FR-CREATE-26** On successful creation, the auction becomes **Active** immediately and is publicly visible in the listing.
- **FR-CREATE-27** The MVP must not support saving an unpublished draft. See §12 for how the Draft state is treated.
- **FR-CREATE-28** A newly created auction has a current price equal to its starting price and an empty bid history.
- **FR-CREATE-29** After creation the user must be taken to the new auction's detail page and see it live.

### 8.4 Auction Listing

- **FR-LIST-01** The system must provide a public listing page showing available auctions, accessible without authentication.
- **FR-LIST-02** Each entry must show: product image (thumbnail), product name, current price, status, and time remaining.
- **FR-LIST-03** Current price must be the starting price when there are no bids, and the highest valid bid otherwise. It must be labelled unambiguously (e.g. `Current bid: 250 SAR` vs `Starting price: 100 SAR`) and always shown in SAR.
- **FR-LIST-04** Time remaining must be shown as a countdown for Active auctions and must update continuously without a page refresh.
- **FR-LIST-05** **The main auction listing shows Active auctions only.** Ended auctions must not appear in it *(decided; formerly Q13)*. Rationale: the listing is the marketplace — a place to find something to bid on. Ended auctions cannot be bid on, so including them would crowd out live inventory and make a small platform look inactive.
- **FR-LIST-05a** **Ended auctions remain permanently accessible** by direct link to their detail page (FR-END-12), and through the "My Auctions" and "My Bids" views if those Should Have items are built (S1, S2). They are removed from the main listing, **not** from the product.
- **FR-LIST-05b** When an auction ends while a user is viewing the listing, its countdown reaches zero and it leaves the listing. The removal must not be jarring — the user must not be left wondering whether the page broke.
- **FR-LIST-06** Default ordering: **soonest end time first**, so the auctions closest to closing — and therefore the most urgent to bid on — appear at the top. Because only Active auctions are listed (FR-LIST-05), no status-based ordering tier is needed.
- **FR-LIST-07** Each entry must link to the auction detail page.
- **FR-LIST-08** The listing must handle the empty case with a clear message and, for authenticated users, a prompt to create the first auction.
- **FR-LIST-09** The listing must remain usable with at least 100 auctions. Pagination or lazy loading is **Should Have** and required only beyond that.
- **FR-LIST-10** Live per-item price updates on the listing page are **Should Have**, not Must Have. Prices must be current as of page load, and countdowns must run live. *(Rationale: real-time is guaranteed where it changes behavior — the detail page.)*
- **FR-LIST-11** The listing must not expose bidder identities, seller email addresses, or any private data.
- **FR-LIST-12** Search, filtering, and sorting controls are **Should Have** (S6).

### 8.5 Auction Details

- **FR-DETAIL-01** The auction detail page must be publicly accessible without authentication.
- **FR-DETAIL-02** It must display the product name in full.
- **FR-DETAIL-03** It must display the full product description with original line breaks preserved.
- **FR-DETAIL-04** It must display the product image at a size adequate to evaluate the item, with a sensible placeholder if the image fails to load.
- **FR-DETAIL-05** It must display the **current price in SAR**, prominently and as the primary numeric element on the page.
- **FR-DETAIL-06** It must clearly distinguish a starting price with no bids from a current bid — e.g. `Starting price: 100 SAR (no bids yet)` versus `Current bid: 250 SAR`. When there are no bids, it must also be clear that a first bid of exactly the starting price is acceptable (BR-28, BR-29).
- **FR-DETAIL-07** It must display the auction **status** (Active / Ended) explicitly.
- **FR-DETAIL-08** For Active auctions it must display a live **countdown** to the end time, updating at least once per second, plus the absolute end time in the viewer's local timezone.
- **FR-DETAIL-09** When the countdown reaches zero, the page must transition to the ended presentation without requiring a manual refresh (see §13).
- **FR-DETAIL-10** It must display **bid history**: every accepted bid with its amount, bidder display name, and timestamp, most recent first.
- **FR-DETAIL-11** Bid history must clearly mark the current highest bid.
- **FR-DETAIL-12** Bid history must show "No bids yet" when empty.
- **FR-DETAIL-13** It must display the **seller's display name**, never their email.
- **FR-DETAIL-14** For an authenticated non-owner viewing an Active auction, it must display a bid input and submit control.
- **FR-DETAIL-15** For an unauthenticated viewer on an Active auction, it must display a sign-in prompt in place of the bid control (FR-AUTH-11).
- **FR-DETAIL-16** For the owner, it must not display a usable bid control; instead it must state that they cannot bid on their own auction.
- **FR-DETAIL-17** For an Ended auction, no bid control is shown to anyone.
- **FR-DETAIL-18** For an Ended auction with at least one bid, it must display the winner's display name and the final winning bid in SAR.
- **FR-DETAIL-19** For an Ended auction with no bids, it must state that the auction ended with no bids and no winner.
- **FR-DETAIL-20** Where the viewer is the winner, the page must state this explicitly and unmistakably, together with the final bid — for example:

  ```text
  🎉 You won this auction!

  Final Bid: 400 SAR
  Status: Ended
  ```

- **FR-DETAIL-21** Where the viewer is the seller of an ended auction, the page must present the outcome from the seller's perspective — for example:

  ```text
  Auction Ended

  Winner: Mohammed
  Final Bid: 400 SAR
  ```

  Or, where there were no bids, a clear statement that the auction ended with no bids and no winner.
- **FR-DETAIL-21a** Neither the winner view nor the seller view may present, imply, or link to a next step — no payment prompt, no contact control, no shipping information, no "complete your purchase". **The result display is the end of the flow** (§19.0).
- **FR-DETAIL-22** Where the viewer bid but did not win, the page should indicate that they did not win. *(Should Have; derivable from history otherwise.)*
- **FR-DETAIL-23** Indicating "You are the highest bidder" during an active auction is **Should Have** (S3).
- **FR-DETAIL-24** Opening an auction whose end time has passed but which has not yet been processed must present it as ended and must not accept bids (EC-04).
- **FR-DETAIL-25** Opening a non-existent auction must show a clear not-found message, not an error page.

### 8.6 Bidding

**Who can bid**

- **FR-BID-01** Only an authenticated user may place a bid; enforced server-side on every attempt (BR-01).
- **FR-BID-02** The auction's owner must never be able to bid on their own auction (BR-02), enforced server-side.
- **FR-BID-03** A bid may only be placed on an auction that is Active at the moment the server evaluates it (BR-04).
- **FR-BID-04** **A user may bid multiple times on the same auction, including while they are already the leading bidder**, provided each new bid satisfies the minimum acceptable bid — that is, it is strictly greater than the current valid price *(decided; formerly Q14)*. Being the current leader is not a reason to reject a bid; only the amount matters.
- **FR-BID-04a** Because there is no increment (BR-32), a leading bidder can raise their own bid by as little as 0.01 SAR. This is permitted. The UI **should** warn — "You are already the highest bidder" — before submission so the user is not doing it accidentally, but the server must accept the bid if the amount qualifies.

**Minimum valid bid**

The **minimum acceptable bid** is the single governing concept. It has exactly two cases:

| Auction state | Minimum acceptable bid | Rule |
|---|---|---|
| **No bids yet** | The starting price, **inclusive** | `First Bid >= Starting Price` |
| **One or more bids** | Anything **strictly above** the current price | `New Bid > Current Price` |

Worked example — starting price `100 SAR`:

```text
Starting Price: 100 SAR

First bid:  100 SAR  → VALID    (may equal the starting price)
First bid:  150 SAR  → VALID    (may also exceed it)

Current price is now 100 SAR.

Second bid: 100 SAR  → INVALID  (must be strictly greater)
Second bid: 101 SAR  → VALID
Second bid: 250 SAR  → VALID
```

- **FR-BID-05** Every bid must meet the **minimum acceptable bid** defined above (BR-28). For every bid after the first, this means **strictly greater** than the current price — equal bids are rejected (BR-03).
- **FR-BID-06** **The first bid on an auction may equal the starting price.** This is an explicit, deliberate special case *(decided; formerly Q6)*. Rationale: `Starting price: 100 SAR` reads to a user as "bidding starts at 100 SAR", so rejecting a bid of exactly 100 SAR contradicts the plain meaning of the label. Once that first bid is accepted, the uniform "strictly greater" rule governs everything after it (BR-29).
- **FR-BID-07** A bid must be numeric, greater than zero, expressed in SAR, and have at most two decimal places.
- **FR-BID-08** **There is no maximum bid amount in the MVP.** No ceiling exists and none may be introduced during implementation *(decided; formerly Q12)*. The only amount constraints are FR-BID-05 and FR-BID-07. See BR-21 for the accepted consequence.
- **FR-BID-09** **There is no minimum bid increment.** A bid of one SAR above the current price is exactly as valid as a bid of one hundred SAR above it *(decided; formerly Q4)*. The system must never require `+5 SAR`, `+10 SAR`, `+50 SAR`, or any other step. The sole amount rule is the minimum acceptable bid.
- **FR-BID-10** The minimum acceptable bid must be visible to the user before they submit, stated in SAR, and must make the inclusive/exclusive distinction clear — for example `Bidding starts at 100 SAR` when there are no bids, and `Enter more than 250 SAR` once bidding is under way.

**Concurrent bids** — product-level statements, not implementation.

- **FR-BID-11** When two or more bids arrive at effectively the same time, the system must establish a single definitive order and evaluate each bid against the state produced by all bids ordered before it.
- **FR-BID-12** For any given current price, **at most one** bid can be accepted as the next bid. A later-ordered bid that no longer beats the updated price must be rejected, even if it was valid against the price the bidder saw.
- **FR-BID-13** A rejected concurrent bid must be rejected with a clear, non-alarming explanation ("Someone bid before you — the current price is now X"), not a generic error.
- **FR-BID-14** No accepted bid may ever be lost, and no bid may be recorded more than once.
- **FR-BID-15** The bid history's price sequence must be strictly increasing at all times.
- **FR-BID-16** The user must always be told definitively whether their bid was accepted or rejected. An ambiguous outcome is a defect.
- **FR-BID-17** The system must not silently adjust a rejected bid upward and resubmit it. Any new bid is a deliberate user action.

**Auction expiry during bidding**

- **FR-BID-18** A bid must be rejected if the auction's end time has passed at the moment the server evaluates it, regardless of what the client displayed (BR-04, EC-02).
- **FR-BID-19** The end-time comparison must use authoritative server time, never client-supplied time.
- **FR-BID-20** A bid arriving fractionally before the end time and evaluating as valid must be accepted and must count toward winner determination, even if the auction closes immediately after.
- **FR-BID-21** On rejection due to expiry, the user must be told the auction has ended and the page must move to its ended presentation.

**Bid history visibility**

- **FR-BID-22** **Bid history is public.** It must be visible on the auction detail page to all viewers, including unauthenticated visitors *(decided; formerly Q10)*. Public history is what makes competition visible and the outcome auditable (PRD §3, Principle 5), and it lets an undecided visitor gauge demand before registering.
- **FR-BID-22a** Public history shows **display names only** — never email addresses, never internal identifiers (BR-26, SEC-P1). The registration flow must make clear that bidding activity is publicly visible, so participation is informed.
- **FR-BID-23** History must show amount, bidder display name, and timestamp for each accepted bid.
- **FR-BID-24** Rejected bid attempts must not appear in bid history.
- **FR-BID-25** History must be immutable — no user, including the seller or the bidder, may edit or delete an entry (BR-05).
- **FR-BID-26** History must remain visible after the auction ends.

**After a successful bid**

- **FR-BID-27** The bidder must receive immediate, explicit confirmation that their bid was accepted.
- **FR-BID-28** The auction's current price must update to the accepted bid amount.
- **FR-BID-29** The new bid must appear at the top of the bid history.
- **FR-BID-30** The change must propagate to all other current viewers in real time (§13).
- **FR-BID-31** The bid input should reset and, if the suggested-amount feature is built (S5), pre-fill the next valid amount.
- **FR-BID-32** The bidder should see that they are now the highest bidder (S3).
- **FR-BID-33** A bid cannot be retracted, cancelled, or edited once accepted (BR-05).

### 8.7 Realtime Updates

- **FR-RT-01** While a user has an Active auction's detail page open, the following must update automatically without a manual refresh: current price, bid history, auction status.
- **FR-RT-02** Time remaining must count down continuously in the client; it does not require a server push, but the authoritative end time comes from the server.
- **FR-RT-03** When another user's bid is accepted, all current viewers must see the new current price within **2 seconds** under normal conditions.
- **FR-RT-04** The new bid must appear in the bid history of all current viewers in the same update.
- **FR-RT-05** A real-time update must be visually noticeable — the changed price should be briefly highlighted or animated so a watching user perceives that something happened.
- **FR-RT-06** A real-time update must never disrupt what the user is doing: it must not clear a partially typed bid amount, steal focus, or scroll the page.
- **FR-RT-07** If the incoming price now exceeds the amount the user has typed, the UI should indicate that their entered amount is no longer sufficient, without altering it.
- **FR-RT-08** When an auction transitions to Ended, all current viewers must see the status change, the bid control disappear, and the outcome appear, without a refresh.
- **FR-RT-09** Real-time updates must be idempotent in effect: a duplicate delivery must not create duplicate history entries or a wrong price.
- **FR-RT-10** Real-time updates must be ordered such that a viewer never sees the price move downward.
- **FR-RT-11** The UI must indicate when the live connection is unavailable, in a way that is informative rather than alarming.
- **FR-RT-12** On reconnection, the client must resynchronize to the authoritative current state — price, history, status — rather than assume it can resume from what it last saw (EC-10).
- **FR-RT-13** While disconnected, the bid control should be disabled or clearly marked as potentially stale, and any bid submitted while stale is still validated server-side and may be rejected.
- **FR-RT-14** Real-time delivery must never be the mechanism that determines a bid's validity. Liveness is a display concern; validity is a server concern.
- **FR-RT-15** Real-time updates must scale to at least 20 simultaneous viewers on a single auction without degrading the 2-second target.
- **FR-RT-16** Real-time updates on the listing page are Should Have (FR-LIST-10).

### 8.8 Auction Ending

- **FR-END-01** An auction must transition from Active to Ended when the current server time reaches or passes its end time.
- **FR-END-02** The transition must occur automatically, with no human action and no dependency on anyone having the page open.
- **FR-END-03** The transition must occur within **30 seconds** of the end time. *(Rationale: bids after the end time are already rejected by FR-BID-18, so a short processing delay cannot corrupt the outcome — it only affects how quickly the ended presentation appears.)*
- **FR-END-04** From the end time onward, no new bid may be accepted, even if the auction record has not yet been marked Ended (FR-BID-18 is the authoritative gate).
- **FR-END-05** At close, the winner is the bidder holding the highest valid bid in history (BR-06).
- **FR-END-06** In the theoretical case of two equal highest bids, the earlier-ordered bid wins. *(In practice FR-BID-05 and FR-BID-12 prevent equal accepted bids; this rule exists so the outcome is defined regardless.)*
- **FR-END-07** If there are no bids, the auction ends with no winner and is recorded as such (BR-09, EC-05).
- **FR-END-08** At close the system must permanently record: ended status, actual close time, final price, and winner identity (or explicitly none).
- **FR-END-09** The final price is the winning bid amount in SAR, or — where there were no bids — the auction ends with no final price and the starting price is retained for display only.
- **FR-END-10** Winner determination must run exactly once per auction and must be idempotent: re-running it must not change a recorded result.
- **FR-END-11** All bid history must be preserved permanently after close, unchanged.
- **FR-END-12** Ended auctions must remain viewable indefinitely by all users.
- **FR-END-13** The seller must see, on their ended auction: the outcome, the winner's display name, the final price, and the full bid history.
- **FR-END-14** The winner must see an explicit statement that they won and the final price they committed to.
- **FR-END-15** Non-winning bidders should see that the auction ended and who won (FR-DETAIL-22).
- **FR-END-16** Any viewer must see that the auction has ended and, if there was one, the winner and final price.
- **FR-END-17** **There is no post-auction workflow.** The seller and the winner are never put in contact, and the product provides no chat, messaging, contact-information exchange, email workflow, payment step, shipping step, or fulfillment step. When an auction ends, the system **displays the result and stops** *(decided; formerly Q9)*. The MVP's final two steps are `Winner Determination → Result Display`.
- **FR-END-17a** Because there is no next step, the winner and seller views must not create the expectation of one (FR-DETAIL-21a). No control, label, or message may suggest that payment, collection, contact, or delivery will follow.
- **FR-END-18** No user, including the seller, may reopen, extend, or re-run an ended auction.

### 8.9 Authorization and Security

- **FR-SEC-01** Every operation that creates or changes data must verify the requester's authenticated identity server-side.
- **FR-SEC-02** Authorization must be derived from server-held state (session identity, stored ownership), never from client-supplied identifiers or flags.
- **FR-SEC-03** A user must not be able to create an auction attributed to another user.
- **FR-SEC-04** A user must not be able to modify or delete **any** auction, including their own. Published auctions are immutable (BR-31) and cannot be cancelled (BR-30), so no modify or delete route may exist for any user.
- **FR-SEC-05** No user may create, modify, or delete a bid record other than by placing a new valid bid through the normal path.
- **FR-SEC-06** No user may set or modify an auction's current price directly; it is derived exclusively from accepted bids (BR-07).
- **FR-SEC-07** No user may set, modify, or claim a winner; the winner is determined solely by the system at close (BR-06).
- **FR-SEC-08** No user may change an auction's status directly; status is derived from lifecycle rules (§12).
- **FR-SEC-09** No user may change an auction's end time after creation — nor its name, description, starting price, or image. All are immutable once published (BR-31).
- **FR-SEC-10** Every bidding rule must be enforced server-side. Client-side checks exist only to give fast feedback and must be assumed absent (BR-08).
- **FR-SEC-11** The system must behave correctly when requests are crafted directly, bypassing the UI entirely — including malformed values, out-of-range amounts, forged identifiers, and requests for actions the UI would not offer.
- **FR-SEC-12** A user must not be able to upload an image to an auction they do not own (FR-CREATE-21).
- **FR-SEC-13** Uploaded files must be validated server-side for type and size before being accepted.
- **FR-SEC-14** Passwords must never be stored in a recoverable form and must never be returned by any read operation.
- **FR-SEC-15** Email addresses must never be exposed to any user other than their owner.
- **FR-SEC-16** Error messages must not disclose whether an account exists, nor leak internal system detail.
- **FR-SEC-17** Rejections must state the reason in product terms ("your bid must be higher than the current price"), without revealing internal state beyond what is already public.
- **FR-SEC-18** Rate limiting on bid submission and authentication attempts is **Should Have**. It must be recorded as a known gap if not implemented for MVP.
- **FR-SEC-19** All data in transit must be encrypted.
- **FR-SEC-20** Session tokens must be stored and transmitted such that they are not readable by third-party scripts or exposed in URLs.

---

## 9. Business Rules

These are the authoritative rules of the product. Every one must be enforced **server-side**. Where a rule is also reflected in the UI, that reflection is a convenience and never the enforcement point.

### 9.1 Core auction rules

| ID | Rule | Enforcement point | Notes |
|---|---|---|---|
| **BR-01** | Only authenticated users can place bids. | Server, on every bid | Every bid must be attributable to a real account |
| **BR-02** | The auction creator cannot bid on their own auction. | Server, on every bid | Prevents self-inflation of price; no exceptions |
| **BR-03** | A bid must meet the **minimum acceptable bid** (BR-28): **≥ the starting price** if it is the first bid, **strictly > the current price** for every bid after it. | Server, on every bid | After the first bid, equal bids are rejected. The first-bid case is an explicit special case — see BR-29 |
| **BR-04** | A bid cannot be accepted at or after the auction's end time, using server time. | Server, on every bid | Independent of whether the auction has been marked Ended yet |
| **BR-05** | A successful bid becomes a permanent, immutable part of bid history. | Server; no modify/delete path exists | No retraction, no editing, by anyone |
| **BR-06** | The highest valid bid at close determines the winner. | System, at close | Not claimable, not grantable, not overridable |
| **BR-07** | Users cannot manually set or change an auction's current price. | Server; price is derived, never written by a user | Current price = highest accepted bid, else starting price |
| **BR-08** | The client is never trusted to determine whether a bid is valid. | All validation server-side | Client checks are UX only |

### 9.2 Additional rules required for a reliable MVP

| ID | Rule | Rationale |
|---|---|---|
| **BR-09** | An auction that closes with zero bids ends with **no winner** and no final sale price. | The most common outcome for a new platform; must be a normal path, not an error |
| **BR-10** | An auction has exactly one owner, set at creation and never transferable. | Ownership underpins BR-02 and all authorization |
| **BR-11** | Concurrent bids are resolved into a single definitive order; each is evaluated against the state produced by all bids ordered before it. | Makes BR-03 unambiguous under contention (FR-BID-11) |
| **BR-12** | At most one bid can be accepted at any given price level. | Prevents two winners at the same price (FR-BID-12) |
| **BR-13** | Current price is always the highest accepted bid; before any bid it is the starting price. | Single definition of "the price"; removes ambiguity between listing, detail, and validation |
| **BR-14** | An auction becomes Active immediately on creation and is publicly visible. | No draft state in MVP (FR-CREATE-26/27) |
| **BR-15** | Auction state transitions are one-directional: Active → Ended. An ended auction can never return to Active. | Prevents reopening, extending, or re-running a settled outcome |
| **BR-16** | Auction end time is fixed at creation and cannot change. | Foundation of a fair, predictable close; reinforced by BR-31 |
| **BR-17** | Winner determination runs exactly once per auction and is idempotent. | A recorded outcome never changes on reprocessing (FR-END-10) |
| **BR-18** | Bid history is append-only and permanent, and remains publicly visible after close. | Auditability; every outcome must be explainable from history |
| **BR-19** | All time-based decisions use authoritative server time; client clocks are display-only. | Client clocks are wrong, skewed, or manipulated |
| **BR-20** | Starting price must be greater than zero. | A zero or negative start makes bidding meaningless |
| **BR-21** | Bid amounts and prices are expressed in **SAR** with at most two decimal places. **There is no maximum price or bid ceiling.** | Two decimals prevent precision errors. No ceiling is imposed because no product requirement justifies one and the values are simulated — see the accepted consequence below |
| **BR-22** | Real-time delivery never determines validity; a bid that was never delivered live is still valid if the server accepted it. | Separates liveness (display) from correctness (server) — §3, Principle 2 |
| **BR-23** | A rejected bid has no effect on auction state and does not appear in history. | Rejected attempts are not facts about the auction |
| **BR-24** | **A user may bid multiple times on the same auction, including while already the leading bidder**, provided each bid meets the minimum acceptable bid (BR-28). Leading is never itself a reason to reject a bid. | Only the amount governs validity. A UI warning is advised, but the server must accept a qualifying bid — see FR-BID-04, FR-BID-04a |
| **BR-25** | The seller has no informational advantage: they see exactly the same live auction state as any other viewer. | Fairness (§3, Principle 4) |
| **BR-26** | Bidder identities in history are shown by display name only; email addresses are never public. | Privacy (FR-AUTH-21, FR-SEC-15) |
| **BR-27** | Every rejected bid must be accompanied by a specific reason the user can act on. | Users cannot compete fairly if failures are opaque |
| **BR-28** | The **minimum acceptable bid** is: the **starting price inclusive** when the auction has no bids; any amount **strictly greater than the current price** when it has at least one. | One governing definition for bid validity, removing all ambiguity between the first bid and later bids |
| **BR-29** | **The first bid on an auction may equal the starting price.** This is an explicit special case; every bid after it must be strictly greater than the current price. | `Starting price: 100 SAR` means "bidding starts at 100 SAR"; rejecting exactly 100 SAR contradicts the label users read |
| **BR-30** | **An auction cannot be cancelled.** Once published it runs to its end time and closes automatically. There is no `Cancelled` state. | A seller able to cancel after seeing a low price would hold an informal reserve, undermining BR-06 and fairness |
| **BR-31** | **A published auction is immutable.** Name, description, starting price, end time, and image cannot be changed after creation, by anyone. | Changing terms mid-auction is unfair to anyone who already bid against those terms |
| **BR-32** | **There is no minimum bid increment.** Any amount meeting BR-28 is valid, whether it exceeds the current price by 1 SAR or 1,000 SAR. | The only amount rule is BR-28; no `+5 / +10 / +50` step may be imposed |
| **BR-33** | The auction currency is **Saudi Riyal (SAR)** for all prices and bids. **All SAR values are simulated demonstration values; Dalal processes no real money.** | Realistic price representation without any financial scope (§19.0) |
| **BR-34** | **The product ends at result display.** After winner determination, the system displays the outcome and takes no further action — no payment, no contact exchange, no fulfillment. | Defines the MVP's terminal boundary unambiguously |
| **BR-35** | **Auctions have no reserve price.** The highest valid bid at close wins, whatever its amount. There is no hidden threshold and no "reserve not met" outcome. | A reserve would add a third close outcome and hidden state, changing winner determination and all three result views. Sellers can achieve the same effect openly by setting a higher starting price |
| **BR-36** | **The auction end time is fixed and is never extended.** A bid arriving in the final seconds does not extend the auction. There is no anti-sniping mechanism. | A fixed end time is far simpler to close correctly, and correctness at close is a Must Have. Reinforces BR-16 and BR-31 |
| **BR-37** | **Email verification is not required to use the platform.** A user may register and immediately browse, create auctions, and bid. **A valid, unique email address is still required at registration**, because it is the login identifier and the only password-reset channel. | Removes a registration barrier from a demonstration platform holding nothing of real value (§19.0), while keeping the address that account recovery depends on |
| **BR-38** | **Auction duration must be between 5 minutes and 7 days**, inclusive, measured from creation using server time. | 5 minutes makes a full lifecycle demonstrable in one sitting; 7 days bounds how long an un-editable, un-cancellable listing stays live |
| **BR-39** | **Display names must be unique across all accounts.** | Public identity must be unambiguous in bid history and in the named winner of the seller's result view. The internal identifier remains the source of truth for attribution |
| **BR-40** | **Bid history is public**, visible to every viewer including unauthenticated visitors, showing display names only. | Visible competition and an auditable outcome are core to the product (§3, Principle 5) |

> **Accepted consequence of BR-21 (no price ceiling).** Without a maximum, a single very large bid can put an auction beyond any realistic competing bid for the rest of its duration. This is accepted deliberately: the SAR values are simulated, so the bidder harms only their own position in a demonstration, and no product or business requirement justifies inventing a ceiling. **Implementers must not add a maximum on their own initiative** — if one is ever wanted, it requires a product decision recorded here first.

### 9.3 Provisional rules — none remain

**Every provisional rule is now final.** No business rule in Dalal depends on an unanswered question.

| Was provisional | Is now | Final decision |
|---|---|---|
| BR-P1 (cancellation) | **BR-30** | No cancellation; no `Cancelled` state |
| BR-P2 (reserve price) | **BR-35** | No reserve price |
| BR-P3 (editing) | **BR-31** | Published auctions are immutable |
| BR-P4 (increment) | **BR-32** | No minimum bid increment |
| BR-P5 (anti-sniping) | **BR-36** | End time is fixed; never extended |
| BR-P6 (email verification) | **BR-37** | Not required; valid email still required at registration |
| — | **BR-29** | First bid may equal the starting price |
| — | **BR-38** | Duration is 5 minutes to 7 days |
| — | **BR-39** | Display names are unique |
| — | **BR-40** | Bid history is public |

The `BR-P*` identifiers are retired and must not be used.

---

## 10. User Stories & Acceptance Criteria

Stories are grouped by area, prefixed `US-`, and each carries testable acceptance criteria. Priority is **[MVP]** or **[Should]**.

### 10.1 Authentication & Identity

**US-01 [MVP] — Register**
*As a new visitor, I want to create an account, so that I can participate in auctions.*

- Given I am unauthenticated, when I open the registration form, then I see fields for email, password, and display name, with the password rule stated.
- Given valid, unused details, when I submit, then my account is created, I am signed in automatically, and I land on the auction listing.
- Given an email already registered, when I submit, then I see a clear failure message, no account is created, and the message does not confirm details about the existing account.
- Given a malformed email or a password under 8 characters, when I submit, then I see a specific message for each failing field and my other entries are preserved.
- Given I bypass client-side validation, when I submit invalid data directly, then the server rejects it and no account is created.

**US-02 [MVP] — Log in**
*As a registered user, I want to sign in, so that I can bid and create auctions.*

- Given correct credentials, when I submit, then I am authenticated, and every page shows my signed-in identity.
- Given incorrect credentials, when I submit, then I see a single generic failure message that does not reveal whether the email exists, and I remain unauthenticated.
- Given I was prompted to sign in from an auction page, when I sign in successfully, then I am returned to that auction.
- Given I have signed in, when I reload the page or navigate away and back, then I am still signed in.

**US-03 [MVP] — Log out**
*As a signed-in user, I want to sign out, so that my account is not left open on a shared device.*

- Given I am signed in, when I select log out, then my session ends and I land on the public listing.
- Given I have logged out, when I attempt to bid, then I am prompted to sign in.
- Given I have logged out, when I use the browser back button to a page that showed authenticated controls, then those controls are not usable and any protected action is rejected.

**US-04 [MVP] — Know my authentication state**
*As any user, I want to see whether I am signed in and as whom, so that I know which identity my bids will be attributed to.*

- Given I am signed in, when I view any page, then my display name is visible in a consistent location.
- Given I am not signed in, when I view any page, then sign-in and register options are visible.
- Given my session expires while I am viewing an auction, when I attempt to bid, then I am told my session expired and prompted to sign in again; viewing continues to work.

**US-23 [MVP] — Reset a forgotten password**
*As a registered user who has forgotten my password, I want to recover access to my account, so that I do not permanently lose my auctions and bidding history.*

- Given I am on the login screen and cannot sign in, when I look for help, then a password reset option is available without needing to be authenticated.
- Given I supply my registered email address, when I submit the reset request, then I am told a reset has been sent if the address is registered.
- Given I supply an email address that is **not** registered, when I submit, then I see **the same** confirmation message as a registered address, so the flow does not reveal which addresses have accounts (FR-AUTH-27).
- Given I received a reset, when I use it, then I can set a new password that must satisfy the same strength rule as registration.
- Given I complete a reset, when I sign in with the new password, then it works — and when I try the old password, it does not.
- Given a reset has already been used, when I try to use it again, then it is rejected with a clear message and an option to request a new one.
- Given a reset has expired, when I try to use it, then it is rejected with a clear message and an option to request a new one.
- Given I only know someone's email address, when I attempt to reset their password, then I cannot complete it without access to their mailbox (FR-AUTH-28).

### 10.2 Auction Creation

**US-05 [MVP] — Create an auction**
*As a registered user, I want to publish an item as an auction, so that others can bid on it.*

- Given I am signed in, when I open the create form, then I see required fields for image, name, description, starting price, and end time.
- Given all fields are valid, when I submit, then the auction is created as Active, I am taken to its detail page, and it appears in the public listing.
- Given a valid new auction, when I view it, then the current price equals my starting price and the bid history shows "No bids yet".
- Given I am not signed in, when I attempt to reach the create form, then I am prompted to sign in and cannot create an auction.
- Given I craft a request specifying a different owner, when the server processes it, then the auction is attributed to my authenticated account, not the supplied one.

**US-06 [MVP] — Get clear validation feedback**
*As a seller, I want to be told exactly what is wrong with my listing, so that I can fix it without guessing.*

- Given a name shorter than 3 or longer than 100 characters, when I submit, then I see a specific message and no auction is created.
- Given a description shorter than 10 or longer than 2000 characters, when I submit, then I see a specific message.
- Given a starting price of zero, a negative number, or more than two decimal places, when I submit, then I see a specific message.
- Given an end time in the past, less than 5 minutes ahead, or more than 7 days ahead, when I submit, then I see a specific message naming the permitted range (BR-38).
- Given an end time exactly 5 minutes ahead, or exactly 7 days ahead, when I submit, then it is accepted — the range is inclusive at both ends.
- Given several fields are invalid, when I submit, then every failing field is reported at once and my valid entries are preserved.
- Given I bypass the client form entirely, when I submit invalid values directly, then the server rejects them with the same rules.

**US-07 [MVP] — Upload a product image**
*As a seller, I want to show a photo of my item, so that buyers can evaluate it.*

- Given a JPEG, PNG, or WebP under 5 MB, when I create the auction, then the image is stored and displayed on both the listing and detail pages.
- Given an unsupported file type or a file over 5 MB, when I submit, then I see a specific message and no auction is created.
- Given a file renamed to a permitted extension but not actually that type, when I submit, then the server rejects it.
- Given the upload fails mid-way, when I am notified, then no partial auction exists and I can retry without re-entering the other fields.
- Given the auction exists, when any user — including one not signed in — views it, then the image loads for them.

### 10.3 Browsing & Viewing

**US-08 [MVP] — Browse auctions**
*As any user, I want to see available auctions, so that I can find something to bid on.*

- Given auctions exist, when I open the listing, then each entry shows a thumbnail, name, current price, status, and time remaining.
- Given I am not signed in, when I open the listing, then I can see all of it without being asked to sign in.
- Given an auction has bids, when I view it in the listing, then the price shown is the highest bid, labelled as the current bid.
- Given an auction has no bids, when I view it in the listing, then the price shown is the starting price, labelled as such.
- Given active and ended auctions exist, when I view the listing, then **only the active ones appear**, ordered by soonest end time (FR-LIST-05, FR-LIST-06).
- Given an auction ends while I am viewing the listing, when its countdown reaches zero, then it leaves the listing without the page appearing broken (FR-LIST-05b).
- Given an auction has ended, when I open its detail page by direct link, then it is still fully viewable with its outcome and complete bid history (FR-LIST-05a, FR-END-12).
- Given no auctions exist, when I open the listing, then I see a clear empty-state message.
- Given I select an entry, when it opens, then I land on that auction's detail page.

**US-09 [MVP] — View auction details**
*As any user, I want to see everything about an auction, so that I can decide whether to bid.*

- Given an active auction, when I open it, then I see the name, full description, image, current price, status, a live countdown, the absolute end time, the seller's display name, and the bid history.
- Given the auction has bids, when I view the history, then each entry shows the amount, bidder display name, and timestamp, most recent first, with the highest clearly marked.
- Given the auction has no bids, when I view the history, then I see "No bids yet".
- Given I am signed in and am not the seller, when I view an active auction, then I see a usable bid control.
- Given I am not signed in, when I view an active auction, then I see a prompt to sign in where the bid control would be.
- Given I am the seller, when I view my active auction, then I see no usable bid control and a message explaining I cannot bid on my own auction.
- Given I open an auction that does not exist, when the page loads, then I see a clear not-found message rather than an error.

### 10.4 Bidding

**US-10 [MVP] — Place a bid**
*As a signed-in user, I want to bid on an item, so that I can try to win it.*

- Given an active auction I do not own and an amount above the current price, when I submit, then my bid is accepted, I receive explicit confirmation, the current price updates to my amount in SAR, and my bid appears at the top of the history.
- **Given an auction with no bids and a starting price of 100 SAR, when I bid exactly 100 SAR, then my bid is accepted** (BR-29).
- Given an auction with no bids and a starting price of 100 SAR, when I bid 150 SAR, then my bid is accepted.
- **Given the current price is 100 SAR, when I bid 101 SAR, then my bid is accepted** — no larger increment is required (BR-32).
- Given my bid is accepted, when I look at the history, then my bid shows my display name, my amount in SAR, and the time it was placed.
- Given my bid is accepted, when I try to retract or edit it, then no mechanism exists to do so.
- Given I am the highest bidder, when I place another higher bid, then it is accepted (BR-24).

**US-11 [MVP] — Have invalid bids rejected clearly**
*As a bidder, I want a clear reason when my bid fails, so that I can correct it.*

- Given the auction already has at least one bid and I enter an amount equal to or below the current price, when I submit, then it is rejected with a message stating the current price in SAR and that my bid must be higher, and no history entry is created.
- **Given the auction already has one bid of 100 SAR and I bid exactly 100 SAR, then it is rejected** — the starting-price equality allowance applies only to the first bid (BR-29).
- Given the auction has no bids and I enter an amount below the starting price, when I submit, then it is rejected with a message stating the starting price in SAR.
- Given a non-numeric, zero, negative, or over-precision amount, when I submit, then it is rejected with a specific message.
- Given a very large amount, when I submit, then it is **not** rejected for being too large — there is no maximum bid (BR-21, FR-BID-08).
- Given I am not signed in, when I attempt to bid, then it is rejected and I am prompted to sign in.
- Given I am the seller, when I attempt to bid via any route including a crafted request, then it is rejected with a message stating owners cannot bid on their own auctions.
- Given the auction has ended, when I submit a bid, then it is rejected with a message stating the auction has ended, and the page updates to the ended presentation.
- Given any rejection, when it occurs, then the auction's price, history, and status are entirely unchanged.

**US-12 [MVP] — Be treated fairly when bidding at the same time as someone else**
*As a bidder, I want simultaneous bids resolved consistently, so that the outcome is fair and predictable.*

- Given two users submit bids at effectively the same moment against the same price, when both are processed, then exactly one is accepted and the other is rejected.
- Given my concurrent bid is rejected, when I see the message, then it explains that another bid arrived first and tells me the new current price.
- Given many bids are submitted rapidly, when I inspect the history afterwards, then every accepted bid appears exactly once and amounts are strictly increasing.
- Given concurrent bids, when the auction closes, then exactly one winner is identified and their bid is the highest in history.
- Given a rejected concurrent bid, when I look at my account, then nothing has been recorded and I may bid again at a higher amount.

### 10.5 Real-time

**US-13 [MVP] — See other people's bids live**
*As a viewer of an auction, I want to see new bids appear automatically, so that I always know the true price.*

- Given I am viewing an active auction and another user's bid is accepted, when it happens, then I see the new current price within 2 seconds without refreshing.
- Given the same event, when it happens, then the new bid also appears in my bid history view.
- Given the update arrives, when I am mid-way through typing a bid amount, then my entry is not cleared, focus is not stolen, and the page does not scroll.
- Given the new price exceeds what I have typed, when the update arrives, then I am shown that my amount is no longer sufficient, and my amount is not changed for me.
- Given the price changes, when it renders, then the change is visually noticeable.
- Given multiple people are viewing, when a bid is accepted, then all of them converge on the same displayed price and history.
- Given updates arrive, when I watch the price, then it never appears to move downward.

**US-14 [MVP] — Keep working when the live connection drops**
*As a viewer, I want to know when updates have stopped, so that I do not act on stale information.*

- Given my live connection drops, when it happens, then I see a clear indication that live updating is unavailable.
- Given the connection is restored, when it reconnects, then the page resynchronizes to the true current price, history, and status.
- Given I was disconnected while bids occurred, when I reconnect, then I see the correct final state rather than a partial or stale one.
- Given I submit a bid while disconnected or stale, when the server evaluates it, then it is validated normally and may be rejected with a clear reason.
- Given the connection is unavailable, when I view the page, then the auction information already loaded remains readable.

### 10.6 Auction ending & results

**US-15 [MVP] — Have my auction close automatically**
*As a seller, I want my auction to end by itself at the time I set, so that I do not have to be present.*

- Given an active auction reaches its end time, when the time passes, then it is marked Ended within 30 seconds without any human action.
- Given the end time has passed, when any user attempts to bid, then the bid is rejected even if the auction record has not yet been marked Ended.
- Given nobody has the page open, when the end time passes, then the auction still closes and the winner is still determined.
- Given the auction has ended, when anyone views it, then the status shows Ended and there is no bid control.

**US-16 [MVP] — See the winner**
*As a seller, I want to see who won my auction and at what price, so that I know how the auction turned out.*

- Given my auction ended with at least one bid, when I view it, then I see the winner's display name and the final winning bid in SAR — e.g. `Winner: Mohammed` / `Final Bid: 400 SAR`.
- Given my auction ended with no bids, when I view it, then I see that it ended with no bids and no winner.
- Given my auction has ended, when I view the bid history, then it is complete and unchanged.
- Given my auction has ended, when I look for controls to reopen, extend, re-run, edit, or cancel it, then none exist (BR-15, BR-30, BR-31).
- Given my auction has ended, when I look at the result, then it presents no next step — no payment, no contact control, no shipping — because the product ends here (BR-34).

**US-17 [MVP] — Know that I won**
*As the winning bidder, I want to be told clearly that I won, so that I know the outcome of the auction I competed in.*

- Given I held the highest bid at close, when I view the auction, then I see an explicit statement that I won and the final winning bid in SAR — e.g. `🎉 You won this auction!` / `Final Bid: 400 SAR` / `Status: Ended`.
- Given I won, when I look at the result, then it presents no next step to complete — winning is the end of the flow (BR-34).
- Given I bid but did not win, when I view the auction, then I see the auction ended and who won, and I am not shown as the winner.
- Given I am any other viewer, when I open the ended auction, then I see the winner's display name and the final price.
- Given the auction ended, when the winner is determined, then it is the bidder with the highest amount in the recorded history, with no exception.

**US-18 [MVP] — Watch an auction end while I am on the page**
*As a viewer present at the close, I want the page to reflect the ending immediately, so that I am not misled into bidding.*

- Given I am viewing an active auction, when the countdown reaches zero, then the page moves to the ended presentation without a manual refresh.
- Given the transition occurs, when I look at the page, then the bid control is gone and the status shows Ended.
- Given the transition occurs, when the result is available, then the winner and final price appear on my screen.
- Given I attempt to bid in the instant around zero, when the server evaluates my bid, then the decision is based on server time and I am told clearly which side of the deadline I fell on.

### 10.7 Should Have stories

**US-19 [Should] — See my auctions.** *As a seller, I want a list of auctions I created, so that I can track them.* — Shows all my auctions with status, current price, time remaining or outcome; ordered active-first; empty state prompts creation; contains only my auctions.

**US-20 [Should] — See my bids.** *As a bidder, I want a list of auctions I have bid on, so that I can track where I stand.* — Each entry shows the auction, my highest bid, the current price, and whether I am leading, outbid, won, or lost; updates when I revisit.

**US-21 [Should] — Know immediately when I am outbid.** *As a bidder, I want the page to tell me when I lose the lead, so that I can respond.* — While leading, an indicator says so; when someone outbids me, it changes to outbid in real time within 2 seconds; when I regain the lead, it reverts.

**US-22 [Should] — Be offered a valid bid amount.** *As a bidder, I want the field pre-filled with a valid amount, so that I bid faster and fail less.* — Field defaults to the smallest valid amount above the current price; updates when the price changes if I have not typed; I can always override it; the server still validates whatever I submit.

---

## 11. User Flows

Each flow lists the happy path and the notable deviations. Flows describe product behavior, not implementation.

### Flow 1 — User registration / login

**1a. Registration**
1. Visitor opens the platform and lands on the public auction listing.
2. They select Register.
3. The form shows email, password, and display name, with the password rule stated.
4. They enter details and submit.
5. The server validates format, password strength, and email uniqueness.
6. On success: the account is created, the user is signed in automatically, and lands on the listing with their display name visible.

*Deviations:* email already registered → clear failure, form retained, no account created. Invalid email or weak password → per-field messages, entries preserved. Server error → clear failure and a retry option; no partial account.

**1b. Login**
1. Visitor selects Sign in.
2. They enter email and password and submit.
3. The server verifies credentials.
4. On success: session established; the user is returned to the page they came from, or the listing.

*Deviations:* wrong credentials → single generic message, still unauthenticated. Session expiry later → informed and prompted to sign in again; public viewing still works.

**1c. Password reset** *(MVP)*
1. On the login screen, the user selects the password reset option.
2. They enter the email address on their account and submit.
3. The system responds with the same confirmation message regardless of whether the address is registered.
4. If the address is registered, a single-use, time-limited reset is delivered to that mailbox.
5. The user opens the reset and sets a new password, which must meet the registration strength rule.
6. The reset is consumed. The user signs in with the new password; the old password no longer works.

*Deviations:* unregistered address → same confirmation message, nothing sent. Reset already used or expired → clear message with the option to request a new one. User never receives it → they can request another. User remembers their password mid-flow → they can simply sign in; an unused reset remains valid until it expires.

### Flow 2 — Creating an auction

1. A signed-in user selects Create auction. *(Unauthenticated → prompted to sign in first, then returned here.)*
2. The form shows image, name, description, starting price, and end time — all required — with rules stated (formats, size limits, length limits, duration bounds).
3. They choose an image; the client may give immediate format/size feedback.
4. They complete the remaining fields and submit.
5. The server validates every field against §8.3 using server time.
6. The image is stored and associated with the auction.
7. The auction is created as **Active**, owned by the authenticated user, with current price = starting price and empty history.
8. The user is taken to the auction detail page and sees it live, with a running countdown.
9. The auction now appears in the public listing.
10. **The auction is now immutable.** The seller cannot edit any field (BR-31) and cannot cancel it (BR-30). It will run to its end time and close automatically.

*Deviations:* validation failure → all failing fields reported at once, nothing created, entries preserved. Image upload failure → clear message, no partial auction, retry without re-entering fields (EC-08). Connection lost during submit → the user is told the outcome is unknown and should check their auctions; the system must not create a duplicate on retry. **Seller notices a mistake after publishing** → nothing can be done; the auction runs to completion (EC-21). Because of this, step 4 should give the seller a clear view of what they are about to publish.

### Flow 3 — Browsing auctions

1. Any user — signed in or not — opens the listing.
2. The page shows **Active auctions only**, ordered by soonest end time (FR-LIST-05, FR-LIST-06). Ended auctions do not appear here.
3. Each entry shows a thumbnail, name, current price in SAR (labelled as current bid or starting price), status, and a live countdown.
4. The user scans and selects one.
5. They land on the auction detail page.

*Deviations:* no active auctions → empty state, with a create prompt if signed in. Many auctions → pagination or lazy loading if built (S6/FR-LIST-09). **An auction ends while the user is on the listing → its countdown reaches zero and it leaves the listing** (FR-LIST-05b); the transition must not look like a page error. **A user wanting an ended auction** reaches it by direct link or through My Auctions / My Bids if built (FR-LIST-05a) — the main listing is a marketplace, not an archive.

### Flow 4 — Opening an auction

1. The user opens an auction from the listing or a direct link.
2. The page loads the current authoritative state: name, description, image, current price, status, countdown, absolute end time, seller display name, and bid history.
3. A live connection is established so the user will receive updates.
4. The bid area renders according to the viewer:
   - **Unauthenticated** → sign-in prompt in place of the bid control.
   - **Signed-in non-owner, auction Active** → usable bid control showing the minimum acceptable amount.
   - **Owner** → no usable control; message explaining owners cannot bid.
   - **Any viewer, auction Ended** → no control; outcome displayed instead.
5. The countdown runs continuously; live updates begin arriving.

*Deviations:* auction does not exist → clear not-found message. End time already passed but not yet processed → presented as ended; bids rejected (EC-04). Live connection unavailable → data still loads and displays; a clear indicator says live updating is unavailable (EC-10).

### Flow 5 — Placing a bid

1. A signed-in non-owner is viewing an Active auction and sees the current price and the minimum acceptable bid.
2. They enter an amount and submit.
3. The client may pre-check the amount for fast feedback; this is not the decision.
4. The server evaluates the bid against, in order: authenticated identity (BR-01), auction exists and is Active by server time (BR-04), bidder is not the owner (BR-02), amount is well-formed — numeric, positive, at most two decimals, in SAR (BR-21), amount meets the **minimum acceptable bid** — ≥ starting price if it is the first bid, strictly > current price otherwise (BR-03, BR-28, BR-29), and ordering against any concurrent bids (BR-11, BR-12). **No increment check is performed; there is no increment** (BR-32). **No maximum check is performed; there is no ceiling** (BR-21).
5. **If accepted:** the bid is recorded permanently in history; current price becomes the bid amount; the bidder gets explicit confirmation; the update is broadcast to all current viewers.
6. The bidder sees their bid at the top of history and, if S3 is built, that they are now leading.

*Deviations:* amount too low → rejected, message states the current price. Auction ended → rejected, page moves to ended presentation (EC-02). Owner attempt → rejected (EC-07). Unauthenticated → prompted to sign in, amount not carried over (FR-AUTH-11). Concurrent loss → rejected with "someone bid before you; the price is now X" (EC-01). Connection lost mid-submit → the user is told the outcome is unknown and must check the current state; on reconnect the true state is shown and no phantom bid exists (EC-03).

### Flow 6 — Another user bids while I am viewing

1. I am viewing an Active auction with the live connection established.
2. Another user's bid is accepted by the server.
3. Within 2 seconds, without any action from me:
   - the current price updates to the new amount,
   - the new bid appears at the top of the history with the bidder's display name, amount, and timestamp,
   - the change is visually noticeable (brief highlight or animation).
4. My context is preserved: any amount I have typed stays, focus is not stolen, the page does not scroll.
5. If my typed amount is now insufficient, I am shown that it no longer qualifies — but it is not changed for me.
6. If S3 is built and I was leading, my status changes to outbid.
7. The minimum acceptable bid shown to me updates to reflect the new price.

*Deviations:* my connection is down → I do not receive the update but I see the "live updating unavailable" indicator; on reconnect I resynchronize to the true state (EC-10). Several bids arrive in rapid succession → each appears in history in the correct order and the price only ever increases (FR-RT-10). I submit at the same moment → my bid is ordered against theirs and one of us is rejected with a clear reason (EC-01).

### Flow 7 — Auction reaches its end time

1. The auction's end time arrives (server time).
2. Bidding stops immediately: any bid evaluated at or after the end time is rejected, regardless of whether the record has been marked Ended yet (BR-04).
3. Within 30 seconds, the system marks the auction **Ended**.
4. The system determines the outcome from recorded history:
   - **At least one bid** → the highest bid is the winner; that amount is the final price; both are recorded permanently.
   - **No bids** → no winner, no final sale price; recorded as ended without bids (BR-09).
5. Close time, final price, and winner (or explicitly none) are recorded permanently. Bid history is preserved unchanged.
6. Everyone currently viewing sees the status change, the bid control disappear, and the outcome appear — without refreshing (FR-RT-08).
7. The auction remains permanently viewable with its full history.

*Deviations:* a bid accepted a fraction of a second before the end time → included and can win (FR-BID-20). A bid arriving a fraction after → rejected (EC-02). Nobody is viewing → the auction still closes and the winner is still determined (FR-END-02). Close processing runs more than once → the result is unchanged (BR-17).

### Flow 8 — Winner views the completed auction

1. The winner opens the ended auction, either by having been present at the close or by returning later.
2. The page shows status **Ended** and no bid control.
3. It states explicitly and unmistakably that they won, together with the final winning bid:

   ```text
   🎉 You won this auction!

   Final Bid: 400 SAR
   Status: Ended
   ```

4. It shows the product details, image, and full bid history, including their winning bid marked as the highest.
5. It shows the seller's display name.
6. **The flow ends here.** There is nothing further for the winner to do.

*Deviations:* they were present at close → the winning state appears live without a refresh. They return much later → the same result renders from the permanent record. **The page must present no next step** — no payment, no collection, no way to contact the seller — because the product provides none (BR-34, FR-DETAIL-21a).

### Flow 9 — Auction owner views the completed auction

1. The seller opens their ended auction.
2. The page shows status **Ended** and no bid control.
3. **If there was at least one bid:** it shows the outcome from the seller's perspective, plus the full bid history:

   ```text
   Auction Ended

   Winner: Mohammed
   Final Bid: 400 SAR
   ```

4. **If there were no bids:** it states clearly that the auction ended with no bids and no winner.
5. No controls exist to reopen, extend, relist, re-run, edit, or cancel the auction, or to alter the result.
6. **The flow ends here.** There is nothing further for the seller to do.

*Deviations:* the seller was present at close → the outcome appears live without a refresh. The seller wants to relist → relisting is not in the MVP; they create a new auction (§22.1). **The seller wants to contact the winner → the product provides no way to do so, by design** (BR-34, FR-END-17).

---

## 12. Auction Lifecycle

### 12.0 The final lifecycle

```text
Auction Creation
       ↓
     Active
       ↓
   Bidding
       ↓
     Ended
       ↓
Winner Determined
       ↓
Result Displayed
```

This is the complete and only lifecycle. There are **no branches, no cancellation, and no manual intervention** anywhere in it:

- **Draft is not a persisted state.** It exists only as the unsubmitted creation form (§12.1).
- **There is no `Cancelled` state.** An auction cannot be cancelled once published (BR-30).
- **An auction cannot be edited** once it enters Active (BR-31).
- **The transition to Ended is automatic**, driven by the end time, requiring no administrator and no human action (BR-15, FR-END-02).
- **Result Displayed is terminal.** Nothing follows it (BR-34).

### 12.1 States

The MVP has **two operative states**, plus a conceptual state that is not persisted.

| State | Persisted? | Meaning | Bidding | Visible in listing | Terminal? |
|---|---|---|---|---|---|
| **Draft** | **No — conceptual only** | The creation form is being filled in, client-side. No auction exists yet. | n/a | No | No |
| **Active** | Yes | The auction is live and accepting bids; end time is in the future. | **Yes**, subject to all business rules | Yes | No |
| **Ended** | Yes | End time has passed; the outcome is determined and recorded. | **No** | Yes, distinguished as ended | **Yes** |
| **Cancelled** | **Does not exist** | ~~Seller-terminated auction~~ — **decided against; not part of Dalal** (BR-30) | — | — | — |

**On Draft.** The lifecycle in the brief reads Draft → Active → Ended, and this PRD honors that shape — but Draft is deliberately **not a persisted state** in the MVP. An auction springs into existence Active (BR-14, FR-CREATE-26). Saving an incomplete auction for later would require partial validation rules, a draft-management surface, and its own authorization story — real work with no MVP user story behind it. Draft therefore exists only as the pre-submission state of the creation form.

**On Cancelled.** **Decided: there is no `Cancelled` state in Dalal** (BR-30). A seller who could cancel after seeing a disappointing price would hold an informal reserve, undermining BR-06 and the fairness principle in §3. Once published, an auction runs to its end time and closes. No cancel control, cancellation rule, or cancellation workflow may be built.

### 12.2 Transitions

| # | Transition | Trigger | Conditions | Effects |
|---|---|---|---|---|
| **T1** | *(none)* → **Active** | Authenticated user submits a valid creation form | All §8.3 validation passes; image stored successfully | Auction created; owner set from session; current price = starting price; history empty; publicly visible |
| **T2** | **Active** → **Ended** | Server time reaches or passes the end time | Automatic; no human action; independent of anyone viewing | Bidding closed; winner determined from history; final price and close time recorded; broadcast to current viewers |

There are no other transitions. Specifically:

- **No Ended → Active.** An ended auction can never reopen, be extended, or be re-run (BR-15, FR-END-18).
- **No Active → Active.** End time and all other published details are immutable (BR-16, BR-31).
- **No Active → Cancelled.** The state does not exist (BR-30).
- **No manual transitions.** No user, including the seller, can change status directly (FR-SEC-08).

### 12.3 State rules

- **LC-01** State is derived from and constrained by the auction record and server time. A user can never write it directly.
- **LC-02** An auction becomes Active immediately at creation; there is no scheduled future start in the MVP.
- **LC-03** **Bidding eligibility is determined by server time against the end time, not by the stored status flag.** From the end time onward, bids are rejected even if the record still says Active (BR-04, FR-BID-18, FR-END-04). This is what makes the ≤30 s processing window in FR-END-03 safe.
- **LC-04** The Active → Ended transition must complete within 30 seconds of the end time (FR-END-03).
- **LC-05** Winner determination happens exactly once and is idempotent (BR-17, FR-END-10).
- **LC-06** Ended is terminal. Everything recorded at close is permanent.
- **LC-07** Bid history is preserved unchanged through and after the transition (BR-18).
- **LC-08** Ended auctions remain publicly viewable indefinitely (FR-END-12).
- **LC-09** Every auction has exactly one owner throughout its lifecycle; ownership never transfers (BR-10).
- **LC-10** The transition must occur whether or not anyone is viewing the auction (FR-END-02).

### 12.4 What must NOT be built

Listed explicitly so no implementer reintroduces it:

| Must not exist | Rule |
|---|---|
| A `Cancelled` state | BR-30 |
| A cancel-auction control, rule, route, or workflow | BR-30, FR-CREATE-25 |
| An edit-auction screen, control, or route | BR-31, FR-CREATE-24 |
| A persisted Draft state or a "save for later" auction | BR-14, FR-CREATE-27 |
| A manual or administrative auction-closing control | §4.3, FR-END-02 |
| Any transition out of Ended | BR-15, FR-END-18 |

---

## 13. Realtime Requirements

Real-time behavior is a **Must Have** and the product's defining characteristic (§3 Principle 3). This section defines what must update live, how quickly, and how the system behaves when liveness fails.

### 13.1 What must update in real time

Scope: a user with an auction **detail page** open.

| Element | Live? | Requirement |
|---|---|---|
| Current price | **Must** | Updates to the new amount when any bid is accepted (FR-RT-01, FR-RT-03) |
| Bid history | **Must** | New accepted bid appears at the top with amount, display name, timestamp (FR-RT-04) |
| Auction status | **Must** | Active → Ended propagates to current viewers (FR-RT-08) |
| Minimum acceptable bid | **Must** | Recalculates when the price changes (Flow 6, step 7) |
| Bid control availability | **Must** | Disappears when the auction ends (FR-RT-08) |
| Outcome (winner, final price) | **Must** | Appears when the auction closes while the user is watching (FR-RT-08) |
| Time remaining | **Must** (client-driven) | Counts down continuously in the client from the server-supplied end time; no server push required (FR-RT-02) |
| Leading / outbid indicator | **Should** | If S3 is built, updates live (US-21) |
| Listing page prices | **Should** | Countdowns run live; per-item price push is Should Have (FR-LIST-10) |
| Viewer count | **Should** | S8 |

### 13.2 Timing and performance

- **RT-P1** A price change must reach all current viewers of that auction within **2 seconds** of server acceptance, under normal conditions (FR-RT-03).
- **RT-P2** The same 2-second target applies to the corresponding history entry and to the ended-status transition.
- **RT-P3** The countdown must update at least once per second and must be derived from the server-supplied end time, not a client-computed one (BR-19).
- **RT-P4** The 2-second target must hold with at least **20 simultaneous viewers** on a single auction (FR-RT-15).
- **RT-P5** Real-time updates must not degrade the responsiveness of the page: a viewer must still be able to type and submit a bid while updates arrive.

### 13.3 Expected user experience when someone else bids

Defined normatively because it is the product's signature moment.

- **RT-X1** The price change must be **perceptible** — a brief highlight or animation, not a silent value swap (FR-RT-05).
- **RT-X2** The update must be **non-disruptive**: it must not clear a partially typed amount, steal focus, scroll the page, or open a dialog (FR-RT-06).
- **RT-X3** If the new price exceeds the amount the user has typed, the UI must **indicate the amount is no longer sufficient** without altering it (FR-RT-07). The user always decides what to bid.
- **RT-X4** The new history entry must appear in correct chronological position — most recent first — and the previously highest bid must lose its "highest" marker.
- **RT-X5** The price must **never appear to move downward** (FR-RT-10). If an out-of-order update arrives, the higher, later state wins.
- **RT-X6** All viewers of the same auction must **converge on the same displayed state** (US-13).
- **RT-X7** When the auction ends while the user watches, the shift to the ended presentation must be clean and unmistakable: status changes, bid control disappears, outcome appears.

### 13.4 Reliability and degradation

- **RT-R1** Real-time delivery is a **display mechanism, never a validity mechanism** (BR-22, FR-RT-14). A bid the server accepted is valid even if no live update was delivered; a live update never makes an invalid bid valid.
- **RT-R2** When the live connection is unavailable, the UI must say so clearly and calmly (FR-RT-11). Silent staleness is a defect.
- **RT-R3** On reconnection the client must **resynchronize to authoritative current state** — price, history, status — rather than resuming from its last-known state (FR-RT-12).
- **RT-R4** While disconnected, the bid control should be disabled or marked as potentially stale; any bid submitted anyway is still fully validated server-side (FR-RT-13).
- **RT-R5** Duplicate delivery of the same update must have no visible effect — no duplicate history rows, no wrong price (FR-RT-09).
- **RT-R6** Loading a page fresh must always yield correct current state regardless of any real-time channel (this is why a refresh always fixes a broken live view — EC-09).
- **RT-R7** Real-time failure must never block bidding for a user who submits anyway; the server path is independent.

### 13.5 Privacy in real-time payloads

- **RT-S1** Real-time updates must contain only data the recipient is already entitled to see: amount, bidder display name, timestamp, price, status, outcome.
- **RT-S2** Email addresses, internal account identifiers beyond what public display requires, and any other private data must never appear in a real-time payload (BR-26, FR-SEC-15).
- **RT-S3** Real-time channels must not become a route to data a user could not fetch directly; the same authorization rules apply.

---

## 14. Security & Authorization Requirements

Product-level requirements. No implementation guidance is given; the mechanism is the team's decision in the architecture phase.

### 14.1 Authentication

- **SEC-A1** Every operation that creates or modifies data must be performed by an identified, authenticated account, verified server-side on each request (FR-SEC-01).
- **SEC-A2** Session validity must be established from server-held state, not from client assertions.
- **SEC-A3** Expired or invalid sessions must be rejected for protected operations and must produce a clear re-authentication prompt, not a silent failure (FR-AUTH-17).
- **SEC-A4** Credentials must never be stored recoverably and must never be returned by any read operation (FR-SEC-14).
- **SEC-A5** Authentication failures must not disclose whether an account exists (FR-AUTH-09, FR-SEC-16).

### 14.2 Authorization

- **SEC-Z1** Authorization must be derived from server-held ownership and identity, never from client-supplied identifiers, roles, or flags (FR-SEC-02).
- **SEC-Z2** A user must not create an auction attributed to anyone but themselves (FR-SEC-03).
- **SEC-Z3** A user must not modify or delete **any** auction, their own included. Published auctions are immutable and cannot be cancelled, so no modify, edit, cancel, or delete route may exist (FR-SEC-04, BR-30, BR-31).
- **SEC-Z4** No user may create, modify, or delete a bid record other than by placing a valid bid through the normal path (FR-SEC-05).
- **SEC-Z5** No user may set an auction's current price directly; it is derived exclusively from accepted bids (BR-07).
- **SEC-Z6** No user may set, claim, or alter a winner (BR-06, FR-SEC-07).
- **SEC-Z7** No user may change an auction's status or end time directly (FR-SEC-08, FR-SEC-09).
- **SEC-Z8** A user may attach an image only to their own auction (FR-CREATE-21, FR-SEC-12).
- **SEC-Z9** Authorization must be enforced for every access route to a resource, including real-time channels (RT-S3). Hiding a control in the UI is not enforcement.

### 14.3 Server-side validation

- **SEC-V1** Every bidding rule in §9 must be enforced server-side on every bid (BR-08, FR-SEC-10).
- **SEC-V2** Every auction-creation rule in §8.3 must be enforced server-side on every creation.
- **SEC-V3** All time-based decisions must use authoritative server time (BR-19, FR-BID-19).
- **SEC-V4** The system must behave correctly when requests bypass the UI entirely — malformed values, out-of-range amounts, forged identifiers, missing fields, unexpected extra fields, and requests for actions the UI never offers (FR-SEC-11).
- **SEC-V5** Uploaded files must be validated server-side for type and size, not by extension or client-reported values (FR-CREATE-18, FR-SEC-13).
- **SEC-V6** Client-side validation exists solely for fast feedback and must be assumed absent when reasoning about correctness.

### 14.4 Data integrity

- **SEC-I1** Bid history must be append-only. No modify or delete path may exist for any user (BR-05, BR-18).
- **SEC-I2** Once recorded, an auction outcome — winner, final price, close time — must be immutable (BR-17).
- **SEC-I3** The current price must always be derivable from bid history; the two must never disagree (BR-13).
- **SEC-I4** Concurrent bids must never produce a lost, duplicated, or out-of-order accepted bid (BR-11, BR-12, FR-BID-14, FR-BID-15).
- **SEC-I5** A rejected bid must leave auction state entirely unchanged (BR-23).
- **SEC-I6** A failed auction creation must leave no partial record and no orphaned image (FR-CREATE-19).

### 14.5 Privacy

- **SEC-P1** Email addresses must never be visible to any user other than their owner (FR-SEC-15).
- **SEC-P2** Public user identity is limited to the display name (FR-AUTH-21, BR-26).
- **SEC-P3** Real-time payloads must contain only data the recipient may already see (RT-S1, RT-S2).
- **SEC-P4** The MVP must not collect personal data beyond what registration and attribution require (FR-PROF-01, FR-PROF-07).

### 14.6 Transport and error handling

- **SEC-T1** All data in transit must be encrypted (FR-SEC-19).
- **SEC-T2** Session tokens must not be exposed in URLs and must not be readable by third-party scripts (FR-SEC-20).
- **SEC-T3** Error messages must state the product-level reason without leaking internal system detail, stack traces, or infrastructure information (FR-SEC-16, FR-SEC-17).
- **SEC-T4** Rejection reasons must be specific enough for a user to act on, without revealing anything not already public (BR-27).

### 14.7 Abuse resistance

- **SEC-R1** Rate limiting on bid submission and authentication attempts is **Should Have** for MVP. If not implemented, it must be explicitly recorded as a known gap before launch (FR-SEC-18).
- **SEC-R2** The system must remain correct — never merely fast — under rapid repeated bidding from a single account. Correctness is Must Have; throttling is Should Have.
- **SEC-R3** **No maximum bid amount is imposed** (BR-21, FR-BID-08). The system must therefore handle very large bid values correctly — accepting them, displaying them, and comparing them without error or overflow — rather than rejecting them. The competitive consequence of a very large bid is an accepted product outcome, not a defect. Implementers must not add a ceiling to work around a display or precision problem; they must handle the value correctly.

### 14.8 Explicit non-requirements for MVP

Not required, and their absence must be recorded as accepted risk: multi-factor authentication; account deletion / data export; audit logging of administrative access; automated fraud or collusion detection; CAPTCHA or bot prevention; IP-based blocking.

**Password reset is no longer on this list — it is now MVP** (M24, FR-AUTH-25 → 31; formerly Q15).

Because no real money is involved (§19.0), the value of a compromised Dalal account is limited to reputational nuisance within the demonstration — placing bids under someone else's display name. This is what justifies deferring MFA and the other items above. **If Dalal were ever to handle real value, every item on this list would need reassessment before launch.**

---

## 15. Error & Edge Cases

Each case states expected **product behavior**. All are testable.

| ID | Case | Expected behavior |
|---|---|---|
| **EC-01** | **Two users bid at nearly the same time** | Both bids are ordered definitively. Exactly one is accepted; the other is rejected because it no longer beats the updated price. The rejected bidder sees a clear, non-alarming message naming the new current price ("Someone bid before you — the price is now X") and may bid again. History shows exactly one entry, strictly increasing. No bid is lost or duplicated. (BR-11, BR-12, FR-BID-11–17) |
| **EC-02** | **Bid submitted exactly as the auction expires** | The server decides using server time at evaluation. Before the end time → accepted, appears in history, counts toward winner determination. At or after → rejected with "this auction has ended", and the page moves to the ended presentation. The user is always told definitively which side of the deadline they fell on. Never ambiguous, never silently dropped. (BR-04, FR-BID-18–21) |
| **EC-03** | **User loses internet connection while bidding** | Two sub-cases. **(a) Request never reached the server:** no bid exists; the user sees a clear failure and may retry. **(b) Request was processed but the response was lost:** the bid exists; on reconnect the user sees the true state — their bid in history if accepted. In both cases the user is told the outcome is unknown and directed to the current state rather than shown a false success. Retrying must not create a duplicate accepted bid at the same amount, since the second attempt would no longer beat the new price. (FR-RT-12, FR-BID-16) |
| **EC-04** | **User opens an expired auction** | Presented as Ended regardless of whether close processing has run. No bid control. If close processing has completed → winner and final price shown. If not yet (within the 30 s window) → status shown as ended with the outcome marked as being finalized, and it appears without a manual refresh once available. Any bid attempted meanwhile is rejected. (FR-DETAIL-24, LC-03) |
| **EC-05** | **No bids are placed** | The auction closes normally with **no winner** and no final price. Seller sees "Auction ended — no bids, no winner". Any viewer sees the auction ended without bids. History shows "No bids yet". This is a normal outcome, never an error state, and must not block or delay close processing. (BR-09, FR-END-07, FR-DETAIL-19) |
| **EC-06** | **Invalid bid amount** | Rejected server-side with a specific reason: below the starting price when there are no bids; at or below the current price when there is at least one (the message names the amount in SAR); non-numeric; zero or negative; or more than two decimal places. **A bid is never rejected for being too large — there is no maximum (BR-21) — and never for being too small an increase above the current price, as long as it is strictly greater (BR-32).** State is entirely unchanged; nothing enters history; the user's entry is preserved so they can correct it. (FR-BID-05–09, BR-23, BR-27) |
| **EC-07** | **User attempts to bid on their own auction** | Rejected server-side with a clear message. The UI does not offer a usable bid control to the owner, but the server rejects the attempt regardless of route, including crafted requests. No history entry, no state change. (BR-02, FR-BID-02, FR-DETAIL-16) |
| **EC-08** | **Auction image upload fails** | The auction is **not created**. The user sees a clear failure message and can retry without re-entering the other fields. No partial auction and no orphaned image is left behind. If the failure is a rejected file (wrong type, too large), the message names the specific problem and the accepted formats and size limit. (FR-CREATE-19, SEC-I6) |
| **EC-09** | **User refreshes the page during an auction** | A refresh always loads correct authoritative current state: price, full history, status, remaining time. The live connection is re-established and updates resume. No state is lost. Refreshing is never required — but it must always work as a recovery action. (RT-R6) |
| **EC-10** | **Realtime connection is temporarily lost** | The UI clearly indicates that live updating is unavailable. Already-loaded information remains readable. The bid control is disabled or marked as potentially stale. On reconnect, the client resynchronizes to authoritative current state — not a resumed partial stream — so any bids missed while offline are reflected. If the auction ended while disconnected, the reconnected page shows the ended state and outcome. (RT-R2, RT-R3, FR-RT-12) |
| **EC-11** | **Multiple users viewing the same auction simultaneously** | All viewers receive the same updates within 2 seconds and converge on the same displayed price, history, and status. No viewer sees a price move downward. Performance holds with at least 20 simultaneous viewers. Each viewer's own context — typed amount, focus, scroll — is preserved through updates. (RT-P4, RT-X5, RT-X6) |

### Additional edge cases the team must handle

| ID | Case | Expected behavior |
|---|---|---|
| **EC-12** | **Session expires while viewing an auction** | Viewing continues to work (public data). Only bidding requires re-authentication; the user is told clearly and prompted, then returned to the auction. (FR-AUTH-18) |
| **EC-13** | **User opens a non-existent or removed auction** | Clear not-found message, not a raw error page. (FR-DETAIL-25) |
| **EC-14** | **Auction ends while the user is mid-way through typing a bid** | The page transitions to the ended presentation, the bid control is removed, and the user is told the auction ended. If they had already submitted, EC-02 governs. |
| **EC-15** | **Two auctions end at the same moment** | Both close independently and correctly within the 30-second window. Neither delays nor affects the other's outcome. |
| **EC-16** | **A user rapidly submits many bids** | Every bid is validated independently. Consecutive self-outbidding is permitted (BR-24). Correctness holds regardless of rate; throttling is Should Have (SEC-R1, SEC-R2). |
| **EC-17** | **Client clock is wrong or manipulated** | Display may be skewed for that user, but every decision — bid validity, auction close — uses server time. A wrong client clock cannot let a user bid after close or block a valid bid. (BR-19) |
| **EC-18** | **Image fails to load for a viewer** (stored fine, delivery fails) | A sensible placeholder is shown; the rest of the auction remains fully functional and biddable. (FR-DETAIL-04) |
| **EC-19** | **Close processing runs more than once for the same auction** | The result is unchanged. Winner and final price are written once and are idempotent. (BR-17, FR-END-10) |
| **EC-20** | **Very long product name or description** | Prevented at creation by the length limits; existing content is displayed without breaking the layout on either the listing or the detail page. (FR-CREATE-04, FR-CREATE-05) |
| **EC-21** | **User submits the creation form twice (double-click or retry)** | The system must not create two identical auctions from a single user intent. **This must be prevented at submission**, because with no cancellation (BR-30) and no editing (BR-31) a duplicate auction cannot be removed by anyone — it will run to its end time and close. This makes duplicate prevention a correctness requirement, not a nicety. |
| **EC-23** | **First bid equals the starting price** | **Accepted.** With a starting price of 100 SAR and no bids, a bid of exactly 100 SAR is valid and becomes the current price (BR-29). Immediately afterwards, a second bid of 100 SAR is **rejected** — the equality allowance applies only to the first bid. The UI must make this transition clear: before any bid it says bidding starts at 100 SAR; after the first bid it requires more than 100 SAR. (FR-BID-06, FR-BID-10, US-10, US-11) |
| **EC-24** | **Bid raises the price by the smallest possible amount** | **Accepted.** With a current price of 100 SAR, a bid of 100.01 SAR is valid. No minimum increment exists (BR-32), and the system must never reject a bid for being an insufficient increase. Long histories of small increments are an accepted product outcome. |
| **EC-25** | **Very large bid amount** | **Accepted.** No maximum exists (BR-21). The system must record, compare, and display the value correctly without error, overflow, or layout breakage. It must not be rejected for size (SEC-R3). |
| **EC-26** | **Seller realizes they made a mistake in a published auction** | Nothing can be done. There is no edit (BR-31) and no cancel (BR-30). The auction runs to its end time and closes. If a bid has been placed, the seller is bound by the outcome. This is a deliberate consequence of the immutability decision; the creation form must therefore make the values clear before submission (FR-CREATE-26a). |
| **EC-27** | **Password reset requested for an unregistered email** | The same confirmation message is shown as for a registered address, and nothing is sent. The flow must never reveal which addresses have accounts (FR-AUTH-27). |
| **EC-28** | **Password reset used twice, or after expiry** | Rejected with a clear message and an option to request a new one. A consumed or expired reset can never set a password (FR-AUTH-29). |
| **EC-22** | **Auction ends with the winner offline** | The outcome is recorded regardless. The winner sees the result whenever they next open the auction. No MVP notification is sent (§16). |

---

## 16. Notifications

### 16.1 Determination

**No notification system is required for the MVP.** Notifications are deferred in their entirety.

Reasoning:

- **The core loop does not depend on them.** Every MVP goal in §5 is met without a notification: bidders see outbid status live while on the page, winners see their result when they open the auction, sellers see their outcome the same way. No user is blocked.
- **Notifications are an engagement feature, not a correctness feature.** They bring users *back*; they do not make auctions work. Engagement mechanics are an explicit non-goal (§5.3).
- **The cost is real for a 3-person team.** Notifications bring templates for each event type, preference management, an opt-out obligation, retry semantics, and a decision about what each notification says. That is a meaningful slice of a small team's capacity, spent outside the core loop. *(Honest caveat: the MVP now includes password reset — M24 — so an email delivery capability does exist. That removes one part of the cost but not the larger part, which is per-event product design and preference management. See §16.5.)*
- **The in-page experience already covers the live case.** A user present at the auction sees outbid status and the result in real time (S3, FR-RT-08). The gap is only for absent users — and closing that gap is what "Future" is for.

The accepted consequence: a user who is outbid while away learns of it only when they return. This is a real product limitation, deliberately accepted for the MVP, and should be revisited immediately after launch.

### 16.2 Notification inventory

| # | Notification | Trigger | MVP? | Notes |
|---|---|---|---|---|
| **N1** | **You have been outbid** | Another user's bid exceeds yours | **Future** | Highest-value future notification; directly drives re-engagement and higher final prices |
| **N2** | **You won this auction** | Auction closes with you as the winner | **Future** | Currently surfaced in-page when the winner opens the auction (FR-END-14) |
| **N3** | **Your auction has ended** (to seller) | Auction closes | **Future** | Currently surfaced in-page (FR-END-13) |
| **N4** | **Your auction ended — here is the winner** (to seller) | Auction closes with at least one bid | **Future** | Would only duplicate the in-page seller result view, since there is no settlement step to prompt (BR-34) |
| **N5** | **Your auction ended with no bids** (to seller) | Auction closes with zero bids | **Future** | Pairs naturally with relisting, which is also Future |
| **N6** | **An auction you bid on is ending soon** | Configurable interval before end time | **Future** | Meaningful only alongside anti-sniping decisions (Q7) |
| **N7** | **A new bid was placed on your auction** (to seller) | Any accepted bid | **Future** | Low value; noisy on active auctions |
| **N8** | **You did not win** | Auction closes with you having bid but not won | **Future** | Low value; visible in-page |

### 16.3 In-page feedback — what the MVP *does* provide

These are not notifications; they are immediate UI feedback, and they are in scope:

| # | Feedback | Scope |
|---|---|---|
| **F1** | Bid accepted confirmation | **MVP** (FR-BID-27) |
| **F2** | Bid rejected with a specific reason | **MVP** (BR-27, FR-BID-13) |
| **F3** | Live price and history updates to current viewers | **MVP** (§13) |
| **F4** | Live status change when an auction ends while viewing | **MVP** (FR-RT-08) |
| **F5** | Live connection unavailable indicator | **MVP** (FR-RT-11) |
| **F6** | Validation feedback on auction creation | **MVP** (FR-CREATE-12) |
| **F7** | "You are the highest bidder" / "You have been outbid" while on the page | **Should Have** (S3, US-21) |
| **F8** | Winner / seller outcome presentation on the ended auction | **MVP** (FR-END-13, FR-END-14) |

### 16.4 If notifications are added later

Requirements to specify at that time — recorded now so the future decision is well-formed, **not to be built for MVP**: users must be able to opt out per notification type; delivery must never gate or delay a bid or a close; notification content must respect §14.5 privacy rules (display names, never emails); a failed notification must never affect auction correctness; and N1 (outbid) should be prioritized first as the clear highest-value case.

### 16.5 Password reset email — the one exception

**Password reset (M24, FR-AUTH-25 → 31) requires delivering an email**, so the MVP does contain exactly one outbound message. This is a **transactional authentication message, not a notification**, and the distinction is deliberate:

| | Password reset email | Notifications (N1–N8) |
|---|---|---|
| Purpose | Account access recovery | Engagement and re-engagement |
| Triggered by | The user explicitly requesting it | System events the user did not ask about |
| Opt-out | None — it is requested, not pushed | Would be required |
| MVP? | **Yes** | **No** |

**Rules:**

- **RS-1** Password reset is the **only** outbound message in the MVP. No auction, bid, or outcome event may send email.
- **RS-2** The existence of email delivery must not be treated as licence to add notifications. Adding any of N1–N8 remains a product decision recorded in this document first.
- **RS-3** The reset email must contain only what the reset requires. It must not include auction information, bid activity, or any other user's data.

---

## 17. Non-Functional Requirements

Product-level and technology-neutral. Each is measurable or testable.

### 17.1 Security

| ID | Requirement |
|---|---|
| NFR-SEC-01 | All rules in §14 are enforced; no MVP feature ships without its authorization checks. |
| NFR-SEC-02 | 100% of state-changing operations are authorized server-side; a test suite must demonstrate that each protected operation fails when attempted without proper authorization. |
| NFR-SEC-03 | All data in transit is encrypted. |
| NFR-SEC-04 | Credentials are never stored recoverably and never returned by any read operation. |
| NFR-SEC-05 | Directly crafted requests bypassing the UI cannot achieve anything the UI forbids; this must be explicitly tested for bidding and auction creation. |

### 17.2 Reliability

| ID | Requirement |
|---|---|
| NFR-REL-01 | Every auction closes within 30 seconds of its end time, with no human intervention, whether or not anyone is viewing (FR-END-03). |
| NFR-REL-02 | Auction closing succeeds for 100% of auctions in testing, including with zero bids, one bid, and many bids. |
| NFR-REL-03 | Winner determination is idempotent: re-running produces an identical result 100% of the time. |
| NFR-REL-04 | No accepted bid is ever lost. Under a concurrency test, accepted-bid count must exactly equal history entry count. |
| NFR-REL-05 | A failed operation leaves no partial state: no half-created auctions, no orphaned images, no phantom bids. |
| NFR-REL-06 | A page refresh always recovers correct current state, regardless of prior client-side failure. |
| NFR-REL-07 | Loss of the real-time channel never prevents bidding via the normal request path. |

### 17.3 Realtime behavior

| ID | Requirement |
|---|---|
| NFR-RT-01 | Price, history, and status updates reach all current viewers of an auction within **2 seconds** of server acceptance, at the 95th percentile under normal conditions. |
| NFR-RT-02 | The target holds with at least **20 simultaneous viewers** on one auction. |
| NFR-RT-03 | Countdown timers update at least once per second and derive from the server-supplied end time. |
| NFR-RT-04 | Reconnection resynchronizes to authoritative state within 5 seconds of connectivity returning. |
| NFR-RT-05 | Duplicate or out-of-order updates never produce a wrong displayed price or a duplicate history entry. |
| NFR-RT-06 | Loss of the real-time channel is surfaced to the user within 10 seconds of detection. |

### 17.4 Performance

| ID | Requirement |
|---|---|
| NFR-PERF-01 | The auction listing page renders usable content within **3 seconds** on a normal broadband connection with up to 100 auctions. |
| NFR-PERF-02 | The auction detail page renders usable content within **3 seconds**, including image and the most recent bid history. |
| NFR-PERF-03 | A bid submission returns an accept/reject decision to the bidder within **1 second** at the 95th percentile under normal conditions. |
| NFR-PERF-04 | Bid history renders efficiently with up to 200 bids on a single auction; beyond that, older entries may be paginated or truncated with a clear indication. |
| NFR-PERF-05 | Product images are delivered at a size appropriate to their display context; a listing thumbnail must not require downloading the full-resolution original. |
| NFR-PERF-06 | Real-time updates must not cause visible layout shift or degrade page responsiveness while the user is typing. |

### 17.5 Data integrity

| ID | Requirement |
|---|---|
| NFR-DAT-01 | Current price always equals the highest accepted bid, or the starting price when there are none — with zero tolerance for divergence. |
| NFR-DAT-02 | Bid history is append-only; no code path, user action, or API permits modification or deletion. |
| NFR-DAT-03 | Accepted bid amounts on an auction are strictly increasing in recorded order, always. |
| NFR-DAT-04 | The recorded winner is always the highest bidder in history, verifiable by independent recomputation for every closed auction. |
| NFR-DAT-05 | SAR amounts are handled with exact two-decimal precision; no rounding drift is acceptable. Because no maximum is imposed (BR-21), large values must also be stored, compared, and displayed exactly — precision must not degrade at scale. |
| NFR-DAT-08 | Every price shown anywhere in the product — listing, detail, bid history, result views — is expressed in SAR using one consistent format. The same amount never appears formatted two different ways. |
| NFR-DAT-06 | All timestamps are stored in a single canonical timezone and are unambiguous. |
| NFR-DAT-07 | Auction outcomes, once recorded, are immutable. |

### 17.6 Scalability

Targets are deliberately modest and matched to an MVP; the point is that they are stated and testable.

| ID | Requirement |
|---|---|
| NFR-SCA-01 | Supports at least **100 concurrent active auctions** without degrading the stated performance targets. |
| NFR-SCA-02 | Supports at least **50 concurrent authenticated users** across the platform. |
| NFR-SCA-03 | Supports at least **20 simultaneous viewers** on a single auction with real-time updates intact. |
| NFR-SCA-04 | Supports at least **10 bids per minute** on a single contested auction with correctness fully preserved. |
| NFR-SCA-05 | Data volume growth (auctions, bids, images) must not require redesign to reach 10× these figures; correctness must not depend on small data volumes. |
| NFR-SCA-06 | Auction closing must scale to many auctions ending at or near the same time without any of them missing the 30-second window. |

### 17.7 Usability

| ID | Requirement |
|---|---|
| NFR-USA-01 | A first-time user can create an auction unaided in under 3 minutes, excluding time spent writing the description. |
| NFR-USA-02 | A user can go from opening the listing to placing a valid bid in **3 interactions or fewer** (open auction → enter amount → submit). |
| NFR-USA-03 | Every rejection message states what went wrong and what to do about it, in plain language, with no error codes or internal terms. |
| NFR-USA-04 | The current price, in SAR, is the most visually prominent element on the auction detail page. |
| NFR-USA-11 | The minimum acceptable bid is stated before submission in a way that makes the inclusive/exclusive distinction unmistakable — "Bidding starts at 100 SAR" with no bids, "Enter more than 250 SAR" once bidding has begun (FR-BID-10, BR-28). |
| NFR-USA-05 | Auction status and time remaining are unambiguous at a glance on both listing and detail pages. |
| NFR-USA-06 | The interface is **fully usable in a mobile web browser** at 375 px width — no horizontal scrolling, no inaccessible controls, and every MVP capability available. This is responsive web design (§1.1), not a mobile application. |
| NFR-USA-07 | Time is displayed in the viewer's local timezone with the timezone made explicit where an absolute time is shown. |
| NFR-USA-08 | Interactive controls are keyboard-accessible and have visible focus states. |
| NFR-USA-09 | Text and interactive elements meet WCAG 2.1 AA contrast requirements. |
| NFR-USA-10 | Real-time changes are communicated by more than color alone, so they are perceivable by color-blind users. |

### 17.8 Maintainability & testability

| ID | Requirement |
|---|---|
| NFR-MNT-01 | Every business rule in §9 must be independently testable in isolation from the UI. |
| NFR-MNT-02 | Concurrent-bidding correctness (BR-11, BR-12) must be covered by an automated test that submits simultaneous bids and asserts a single acceptance. |
| NFR-MNT-03 | Auction closing must be triggerable in a test environment without waiting real elapsed time. |
| NFR-MNT-04 | The system must run locally end-to-end so a developer can exercise a full auction lifecycle without shared infrastructure. |

---

## 18. Success Criteria

The MVP is successful when **all** Tier 1 criteria pass. Tier 2 criteria are quality gates that should pass; any failure must be explicitly accepted before launch.

### 18.1 Tier 1 — release gate (must all pass)

**Auction creation**

| ID | Criterion | How it is verified |
|---|---|---|
| SC-01 | An authenticated user can create an auction with image, name, description, starting price, and end time, and it appears in the public listing immediately. | Manual + automated end-to-end test |
| SC-02 | Every creation validation rule (§8.3) rejects invalid input server-side with a specific message and creates nothing. | Test each rule individually, including via direct requests |
| SC-03 | A newly created auction shows current price = starting price and an empty bid history. | Automated test |
| SC-04 | A failed image upload creates no auction and leaves no orphaned image. | Fault-injection test |

**Discovery and viewing**

| ID | Criterion | How it is verified |
|---|---|---|
| SC-05 | Any user, signed in or not, can browse the listing and see image, name, current price, status, and time remaining for each auction. | Manual, both auth states |
| SC-06 | Any user can open an auction and see all required detail-page information (§8.5). | Manual, all viewer types |
| SC-07 | The bid area renders correctly for each viewer type: sign-in prompt (unauthenticated), usable control (non-owner), disabled with explanation (owner), absent (ended). | Manual matrix test |

**Bidding**

| ID | Criterion | How it is verified |
|---|---|---|
| SC-08 | An authenticated non-owner can place a valid bid on an active auction and receives explicit confirmation. | Automated end-to-end test |
| SC-09 | Once an auction has at least one bid, a bid at or below the current price is rejected with a message naming the current price in SAR, and state is unchanged. | Automated test |
| SC-10 | An unauthenticated bid attempt is rejected, including via a crafted request. | Automated test bypassing the UI |
| SC-11 | An owner's bid on their own auction is rejected, including via a crafted request. | Automated test bypassing the UI |
| SC-12 | A malformed bid (non-numeric, zero, negative, more than two decimals) is rejected server-side. | Automated test per case |
| **SC-55** | **On an auction with no bids and a starting price of 100 SAR, a first bid of exactly 100 SAR is accepted** (BR-29). | Automated test |
| **SC-56** | Immediately after that, a second bid of exactly 100 SAR is **rejected**; a bid of 100.01 SAR is **accepted** (BR-28, BR-32). | Automated test |
| **SC-57** | A bid is never rejected for being an insufficient increase above the current price, and never for being too large — no increment and no ceiling exist (BR-21, BR-32). | Automated test with a 0.01 SAR increase and with a very large amount |
| SC-13 | Every rejection gives a specific, actionable reason. | Review of all rejection paths |
| SC-14 | An accepted bid appears in history with amount, display name, and timestamp, and updates the current price. | Automated test |
| SC-15 | No mechanism exists for any user to edit or delete a bid. | Code and API review + attempted-modification test |

**Concurrency**

| ID | Criterion | How it is verified |
|---|---|---|
| SC-16 | When two bids are submitted simultaneously against the same price, exactly one is accepted and one rejected. | Automated concurrency test, repeated |
| SC-17 | Under rapid concurrent bidding, history contains every accepted bid exactly once with strictly increasing amounts. | Automated stress test |
| SC-18 | A concurrency rejection tells the user another bid arrived first and names the new price. | Manual + automated |
| SC-19 | After concurrent bidding, close determines exactly one winner matching the highest bid in history. | Automated test |

**Real-time**

| ID | Criterion | How it is verified |
|---|---|---|
| SC-20 | Two browsers viewing the same auction both show the new price within 2 seconds of a bid, with no refresh. | Manual two-browser test + timed automated test |
| SC-21 | The new bid appears in both viewers' history in the same update. | Same test |
| SC-22 | A live update does not clear a partially typed bid amount, steal focus, or scroll the page. | Manual test |
| SC-23 | Auction close propagates to all current viewers without a refresh: status changes, bid control disappears, outcome appears. | Manual multi-browser test |
| SC-24 | Loss of the live connection is surfaced to the user, and reconnection resynchronizes to correct state. | Manual test with the network disabled and restored |

**Auction ending and winner determination**

| ID | Criterion | How it is verified |
|---|---|---|
| SC-25 | Every auction is marked Ended within 30 seconds of its end time, with no human action. | Automated timing test across many auctions |
| SC-26 | Auctions close correctly even when nobody is viewing. | Automated test with no clients connected |
| SC-27 | Bids submitted at or after the end time are always rejected, even before the record is marked Ended. | Automated boundary test |
| SC-28 | A bid accepted just before the end time counts toward winner determination. | Automated boundary test |
| SC-29 | The recorded winner is the highest bidder in history for **100%** of closed auctions, verified by independent recomputation. | Automated verification over all test auctions |
| SC-30 | The recorded final price equals the winning bid amount for 100% of closed auctions with bids. | Automated verification |
| SC-31 | An auction closing with zero bids ends with no winner, no error, and a clear message to the seller and to viewers. | Automated + manual test |
| SC-32 | Re-running close processing does not change a recorded result. | Automated idempotency test |
| SC-33 | Bid history is preserved unchanged after close. | Automated before/after comparison |
| SC-34 | No control exists to reopen, extend, or re-run an ended auction. | Review + attempted-action test |

**Results visibility**

| ID | Criterion | How it is verified |
|---|---|---|
| SC-35 | The seller of an ended auction sees the winner's display name, the final price, and the full history. | Manual test |
| SC-36 | The winner sees an explicit statement that they won and the final price. | Manual test |
| SC-37 | Any other viewer sees that the auction ended, and who won at what price. | Manual test |

**Security and authorization**

| ID | Criterion | How it is verified |
|---|---|---|
| SC-38 | A user cannot modify or delete another user's auction by any route. | Automated authorization test |
| SC-39 | A user cannot create an auction attributed to another user. | Automated test with a forged owner identifier |
| SC-40 | A user cannot set an auction's current price, status, end time, or winner directly. | Automated test per field |
| SC-41 | A user cannot attach an image to an auction they do not own. | Automated test |
| SC-42 | Email addresses are never visible to other users anywhere, including in real-time payloads. | Review of all responses and payloads |
| SC-43 | Every bidding rule is enforced when the UI is bypassed entirely. | Automated direct-request suite covering BR-01 to BR-08 and BR-28 to BR-32 |
| **SC-58** | No route exists — via UI or crafted request — to edit a published auction's name, description, starting price, end time, or image (BR-31). | Automated test per field |
| **SC-59** | No route exists — via UI or crafted request — to cancel an auction, and no `Cancelled` state can be reached (BR-30). | Automated test |

**Authentication and account recovery**

| ID | Criterion | How it is verified |
|---|---|---|
| **SC-60** | A user who has forgotten their password can complete a reset and sign in with the new password. | Manual + automated end-to-end test |
| **SC-61** | A reset request for an unregistered email returns the same confirmation message as a registered one, disclosing nothing. | Automated test comparing both responses |
| **SC-62** | A reset cannot be completed without access to the registered mailbox; knowing the email address alone is insufficient. | Automated test |
| **SC-63** | A reset is single-use and time-limited; reuse and expiry are both rejected with a clear message. | Automated test per case |
| **SC-64** | After a successful reset, the old password no longer authenticates. | Automated test |

**Currency, scope, and result display**

| ID | Criterion | How it is verified |
|---|---|---|
| **SC-65** | Every price in the product — listing, detail, bid input, bid history, winner and seller result views — is displayed in SAR with one consistent format. | Review of every price surface |
| **SC-66** | The winner of a closed auction sees an explicit win statement with the final bid in SAR, and the seller sees the winner's display name with the same final bid. | Manual test, both viewpoints |
| **SC-67** | No screen in the product offers or implies payment, checkout, contact exchange, messaging, shipping, or fulfillment (§19.0, BR-34). | Full walkthrough of every screen |

**Final product decisions — enforcement**

| ID | Criterion | How it is verified |
|---|---|---|
| **SC-68** | An end time less than 5 minutes or more than 7 days ahead is rejected with a message naming the permitted range; exactly 5 minutes and exactly 7 days are accepted (BR-38). | Automated boundary test, all four cases |
| **SC-69** | Registration rejects a display name already in use, with a specific message; two accounts can never share a display name (BR-39). | Automated test |
| **SC-70** | A user can register and immediately create an auction and place a bid **without any email verification step** (BR-37). | Automated end-to-end test |
| **SC-71** | The main listing contains **only Active auctions**; an ended auction never appears in it, yet remains fully viewable by direct link with its outcome and history (BR-40 context, FR-LIST-05, FR-LIST-05a). | Automated test + manual check |
| **SC-72** | The current leading bidder can place a further bid that is strictly greater than the current price, and it is accepted (BR-24, FR-BID-04). | Automated test |
| **SC-73** | No reserve-price field, control, or "reserve not met" outcome exists anywhere; the highest valid bid always wins regardless of amount (BR-35). | Review + automated winner test |
| **SC-74** | A bid accepted in the final seconds does **not** extend the auction; the end time recorded at creation is the end time used at close (BR-36). | Automated test |
| **SC-75** | Bid history is visible to an unauthenticated visitor, showing display names and amounts in SAR, and never an email address (BR-40, FR-BID-22a). | Manual test signed out + payload review |

### 18.2 Tier 2 — quality gates (should pass; failures must be explicitly accepted)

| ID | Criterion |
|---|---|
| SC-44 | Listing and detail pages render usable content within 3 seconds with 100 auctions present. |
| SC-45 | Bid submission returns a decision within 1 second at the 95th percentile. |
| SC-46 | Real-time updates hold the 2-second target with 20 simultaneous viewers on one auction. |
| SC-47 | A first-time user creates an auction unaided in under 3 minutes. |
| SC-48 | A user reaches a placed bid in 3 interactions or fewer from the listing. |
| SC-49 | The interface is fully usable on a 375 px-wide mobile browser. |
| SC-50 | All interactive controls are keyboard-accessible with visible focus states. |
| SC-51 | Text and controls meet WCAG 2.1 AA contrast. |
| SC-52 | Every edge case EC-01 to EC-22 behaves as specified. |
| SC-53 | A page refresh at any point during an auction always recovers correct state. |
| SC-54 | 100 concurrent active auctions and 50 concurrent users are supported without degrading Tier 1 behavior. |

### 18.3 Demonstration scenario

A single end-to-end scenario that must pass in full before the MVP is considered complete:

1. User A registers, then creates an auction with an image, a **starting price of 100 SAR**, and a 10-minute end time.
2. A confirms the auction is now immutable — there is no edit control and no cancel control anywhere on it.
3. Users B and C register and open the auction in separate browsers.
4. **B bids exactly 100 SAR** — the starting price — and it is **accepted** (BR-29). Both B and C see `Current bid: 100 SAR` and the new history entry within 2 seconds, with no refresh.
5. **C bids exactly 100 SAR** and it is **rejected**, with a message naming the current price (BR-28).
6. **C bids 100.01 SAR** and it is **accepted** — no minimum increment is required (BR-32). Both see the update; B sees they are no longer leading.
7. C bids **50,000 SAR** and it is **accepted** — no maximum exists (BR-21).
8. A attempts to bid on their own auction → rejected with a clear message.
9. B attempts a bid below the current price → rejected with a message naming the current price in SAR.
10. B and C bid simultaneously → exactly one is accepted; the other sees a clear "someone bid before you" message with the new price.
11. An unauthenticated visitor opens the auction → sees full detail and history, and a sign-in prompt in place of the bid control.
12. The end time passes → within 30 seconds the auction shows Ended to all current viewers, with no refresh, and the bid control disappears.
13. A bid submitted immediately after the end time is rejected.
14. **The winner sees `🎉 You won this auction!` with `Final Bid: <amount> SAR`; A sees `Winner: <name>` with the same final bid; the other bidder sees the outcome.** None of these views offers or implies payment, contact, or shipping.
15. A separate auction created with no bids closes cleanly with no winner, no final price, and a clear message to the seller.
16. A user who has forgotten their password completes a reset and signs in with the new password; the old password no longer works.

---

## 19. Out of Scope

Everything listed is explicitly **not built** in the MVP. Each has a reason; items without a strong reason to defer are not listed here.

### 19.0 Payment and transaction scope — the defining boundary

> **Dalal is not a payment or commerce platform.**
>
> The MVP simulates auction bidding behavior. Prices are displayed in **Saudi Riyal (SAR)** to make the demonstration realistic, but **all SAR values are simulated. No real money is involved at any point, in any form.**

**Explicitly excluded, without exception:**

| Excluded | |
|---|---|
| Payment processing | Checkout |
| Card payments (credit or debit) | Payment gateways |
| Wallets or stored balances | Bank transfers |
| Refunds | Financial settlement or escrow |
| Invoicing, receipts, fees, or commission | Shipping and logistics |
| Order fulfillment | Real-world transaction processing of any kind |

**What this means in practice:**

- **SC-67** requires that no screen anywhere in the product offers or implies any of the above.
- **BR-34** makes result display the terminal step: after the winner is determined and shown, the product takes no further action.
- **FR-DETAIL-21a** and **FR-END-17a** forbid the winner and seller views from presenting a next step.
- The term **"Demo Points" must never be used.** Prices are SAR — simulated SAR, but SAR.

**Why the boundary is drawn here.** Payments would bring regulatory obligations, a provider integration, refunds, chargebacks, and dispute handling — collectively larger than the entire rest of the MVP, and unnecessary to demonstrate that a real-time auction works correctly. Excluding real money also removes the need for MFA, fraud detection, and audited administrative access (§14.8), which is what makes a three-person MVP feasible at all.

### 19.1 Commercial transaction

| Excluded | Reason |
|---|---|
| **Payment processing** | Brings regulatory obligations (PCI, KYC, tax), refunds, chargebacks, and a payment provider integration — larger than the entire rest of the MVP and unnecessary to validate that live auctions work |
| **Escrow / settlement** | Depends on payments |
| **Shipping and logistics** | Depends on payments and addresses; introduces address collection, carriers, tracking |
| **Invoicing / receipts** | Depends on payments |
| **Fees and commission** | A business-model decision, not yet made, and dependent on payments |
| **Refunds and disputes** | Depends on payments; also implies moderation and admin tooling |

**Consequence:** the MVP ends at winner determination and result display. **There is no settlement, and no mechanism for the parties to arrange one** — no contact exchange, no messaging (BR-34, FR-END-17). This is a finalized decision, not an open question.

### 19.2 Advanced auction mechanics

| Excluded | Reason |
|---|---|
| **Reserve prices** | **Decided against (BR-35).** Adds hidden state and a third close outcome. Sellers can set a higher starting price instead |
| **Proxy / automatic bidding** | Substantially complicates the bidding engine and concurrency model; the MVP must first prove simple bidding is correct |
| **Anti-sniping time extension** | **Decided against (BR-36).** The end time is fixed. A dynamic end time complicates closing, the countdown, and realtime propagation |
| **Buy-it-now** | A second, different transaction path with its own rules |
| **Bid retraction** | Directly conflicts with BR-05 immutability |
| **Auction editing after publish** | **Decided against (BR-31)** — changing terms mid-auction is unfair to existing bidders |
| **Auction cancellation** | **Decided against (BR-30)** — would function as a hidden reserve and undermine trust |
| **Minimum bid increments** | **Decided against (BR-32)** — the only amount rule is BR-28 |
| **Maximum price or bid ceiling** | **Decided against (BR-21)** — no product requirement justifies one |
| **Scheduled future start times** | Adds a third lifecycle state with no MVP demand |
| **Multiple quantity / lots** | A fundamentally different auction model |
| **Bid increments of any kind, per-auction or platform-wide** | Decided against entirely (BR-32); the sole amount rule is BR-28 |

### 19.3 Communication

| Excluded | Reason |
|---|---|
| **Email / push / SMS notifications** | See §16; engagement, not correctness |
| **Buyer–seller messaging or contact exchange** | **Decided against (BR-34, FR-END-17).** The product displays the result and stops; there is nothing for the parties to arrange, since no goods or money change hands |
| **Comments or Q&A on listings** | Moderation burden, no core-loop value |
| **Newsletters / marketing** | Not a product requirement |

### 19.4 Social and reputation

| Excluded | Reason |
|---|---|
| **Ratings and reviews** | Meaningful only once transactions complete, which requires payments |
| **Seller reputation / badges** | Same dependency |
| **Following sellers, watchlists, favorites** | Engagement features; pull toward notifications |
| **Public user profiles** | Conflicts with the minimal-profile position (FR-PROF-07) and adds a privacy surface |
| **Social sharing** | Growth feature |

### 19.5 Discovery and personalization

| Excluded | Reason |
|---|---|
| **Recommendation systems** | Requires data volume and behavior history the MVP does not have |
| **Categories and taxonomy** | Valuable at scale; unnecessary at MVP volume |
| **Advanced search / faceted filtering** | Basic sorting and filtering is Should Have (S6); anything beyond is Future |
| **Saved searches / alerts** | Depends on notifications |

### 19.6 Operations and administration

| Excluded | Reason |
|---|---|
| **Admin dashboard** | See §4.3; no MVP feature requires it and it expands the authorization surface |
| **Moderation queues / reporting** | Depends on admin tooling; handled out-of-band at MVP scale (§4.3) |
| **User suspension / banning** | Same |
| **Analytics dashboards** | Not needed to validate the core loop |
| **Bulk listing / seller tools** | Professional sellers are not a target user (§4.2) |
| **Data export / reporting** | No MVP demand |

### 19.7 Platform reach

| Excluded | Reason |
|---|---|
| **Native mobile applications of any kind** — Flutter, Android, iOS | **Dalal is a website** (§1.1). A responsive web interface serves all target users on both desktop and mobile browsers (NFR-USA-06, SC-49). No native mobile architecture, no device builds |
| **App Store / Google Play distribution** | Nothing is distributed through an app store. The product is reached by URL |
| **Multi-language support** | Adds translation to every string and message; no identified need |
| **Multi-currency** | Requires exchange rates and per-auction currency; **SAR alone is sufficient** (FR-CREATE-13, BR-33) |
| **Offline mode** | Fundamentally incompatible with live auctions |
| **Public API for third parties** | No identified consumer |

### 19.8 Advanced security and account management

| Excluded | Reason |
|---|---|
| **Multi-factor authentication** | Disproportionate for an MVP without payments |
| **Social / OAuth sign-in** | Email + password is sufficient; adds provider integration |
| ~~Password reset~~ | **No longer excluded — password reset is now MVP** (M24, FR-AUTH-25 → 31) |
| **Account deletion / data export** | Regulatory relevance acknowledged; no MVP mechanism |
| **Fraud / collusion detection (shill bidding)** | Requires behavioral analysis; BR-02 covers only the direct self-bidding case |
| **CAPTCHA / bot prevention** | Not warranted at MVP scale |

### 19.9 Media

| Excluded | Reason |
|---|---|
| **Multiple images per auction** | One image is sufficient to evaluate an item (FR-CREATE-15) |
| **Video** | Storage and playback complexity, no core-loop value |
| **Image editing / cropping** | Users can prepare images themselves |
| **Automatic image moderation** | Depends on moderation tooling |

---

## 20. Assumptions

Assumptions the team is making. **Every assumption that once required confirmation has been resolved by a product decision (§21.1).** None remains open; the rows below are retained for traceability and to record accepted consequences.

### 20.1 About users

| ID | Assumption | Confirm? |
|---|---|---|
| A-U1 | Users are individuals, not businesses, and are comfortable using a web application. | |
| A-U2 | **Decided:** users access Dalal through a modern desktop or mobile **web browser**. No native application is built or expected (§1.1). | Resolved |
| A-U3 | Users will accept email + password registration and do not require social sign-in. | |
| A-U4 | Users are willing to register before bidding; the account requirement is not a blocker. | |
| A-U5 | Users trust the platform enough to participate without ratings, reviews, or reputation. | |
| A-U6 | **Decided:** users accept that Dalal is a demonstration with simulated SAR prices, that no money changes hands, and that the product provides no settlement, contact, or delivery of any kind (§19.0, BR-34). | Resolved |
| A-U7 | The same person may be both a seller and a bidder; no separate account types are needed. | |
| A-U8 | Users understand basic auction concepts (bidding, outbidding, closing time) without a tutorial. | |
| A-U9 | **Decided:** users may forget their passwords, and the MVP provides a self-service reset (M24). This assumption is retired. | Resolved |
| A-U10 | English is sufficient for all users in the MVP period. | |

### 20.2 About auctions

| ID | Assumption | Confirm? |
|---|---|---|
| A-A1 | An auction sells exactly one item, in one quantity. | |
| A-A2 | **Decided:** auctions are simple ascending-price auctions with **no reserve price** (BR-35). | Resolved |
| A-A3 | **Decided:** an auction's terms are fixed and immutable once published (BR-31). | Resolved |
| A-A4 | **Decided:** an auction cannot be cancelled after publishing (BR-30). Sellers accept that a mistake cannot be undone (EC-26). | Resolved |
| A-A5 | Auctions become live immediately on creation; nobody needs to schedule a future start. | |
| A-A6 | **Decided:** auction durations are **5 minutes to 7 days** (BR-38). This range covers all MVP needs. | Resolved |
| A-A7 | **Decided:** a single currency — SAR — is used platform-wide, with simulated values (BR-33). | Resolved |
| A-A8 | Sellers will write their own descriptions and provide their own images; no templates needed. | |
| A-A9 | Auction volume during the MVP is low enough that manual, out-of-band moderation is workable. | Accepted gap (§4.3) |
| A-A10 | Ended auctions are retained indefinitely; no archival or deletion policy is needed. | |

### 20.3 About bidding

| ID | Assumption | Confirm? |
|---|---|---|
| A-B1 | Bidders enter explicit amounts; nobody expects proxy or automatic bidding in the MVP. | |
| A-B2 | **Decided:** no bid increment is required; the minimum acceptable bid (BR-28) is the sole amount rule (BR-32). | Resolved |
| A-B3 | **Decided:** the first bid **may equal** the starting price; every bid after it must be strictly greater (BR-29). | Resolved |
| A-B4 | **Decided:** a user may bid again while already leading, provided the bid is strictly greater than the current price (BR-24, FR-BID-04). | Resolved |
| A-B5 | Bidders accept that bids are final and cannot be retracted. | |
| A-B6 | **Decided:** the end time is hard and is never extended for last-second bids (BR-36). Bidders accept that sniping is possible. | Resolved |
| A-B7 | Concurrent bidding volume on a single auction stays within roughly 10 bids per minute (NFR-SCA-04). | |
| A-B8 | Two-decimal precision is sufficient for all amounts. | |
| A-B9 | **Decided:** there is **no** maximum bid or price ceiling (BR-21). The team accepts that a very large bid can dominate an auction, and must not introduce a ceiling to prevent it. | Resolved |
| A-B10 | **Decided:** bid history — display name and amounts — is public to everyone, including unauthenticated visitors (BR-40). Registration must make this clear so participation is informed. | Resolved |

### 20.4 About images

| ID | Assumption | Confirm? |
|---|---|---|
| A-I1 | One image per auction is sufficient to evaluate an item. | |
| A-I2 | JPEG, PNG, and WebP cover what users will upload. | |
| A-I3 | A 5 MB limit is generous enough for phone photographs. | |
| A-I4 | Users will resize or compress large images themselves if rejected; no in-product editing is needed. | |
| A-I5 | Images may be publicly readable, including by unauthenticated visitors. | |
| A-I6 | Uploaded images do not require automated content moderation during the MVP. | Accepted gap (§4.3) |
| A-I7 | Image storage cost and volume are negligible at MVP scale. | |

### 20.5 About authentication and identity

| ID | Assumption | Confirm? |
|---|---|---|
| A-T1 | Email + password authentication is sufficient. | |
| A-T2 | **Decided:** email verification is **not** required to use the platform (BR-37). **Accepted consequence:** a user who registers with an address they cannot receive mail at will be unable to reset a forgotten password (FR-AUTH-07b), and with no Admin role (§4.3) nobody can help them. Accepted because Dalal holds nothing of real value (§19.0). | Resolved — consequence accepted |
| A-T3 | An 8-character minimum password is an acceptable strength floor for an MVP without payments. | |
| A-T4 | **Decided:** display names **must be unique** (BR-39). The internal identifier remains the source of truth for attribution and authorization. | Resolved |
| A-T5 | Sessions persisting across browser restarts is acceptable and desirable. | |
| A-T6 | One account per person; the MVP does not need to detect or prevent multiple accounts. | **Related — shill bidding, §19.8** |
| A-T7 | Multi-factor authentication is not expected by users at this stage. | |

### 20.6 About real-time behavior

| ID | Assumption | Confirm? |
|---|---|---|
| A-R1 | A 2-second update latency is perceived by users as "real time". | |
| A-R2 | Users tolerate brief interruptions in liveness as long as they are told and state recovers on reconnect. | |
| A-R3 | At most ~20 people watch a single auction simultaneously during the MVP. | |
| A-R4 | Users' browsers and networks support a persistent live connection; a refresh-based fallback is acceptable for the minority that cannot. | |
| A-R5 | Users do not require live updates on the listing page for the product to feel live (FR-LIST-10). | |
| A-R6 | Client clocks may be wrong; users accept that all decisions use server time. | |

### 20.7 About the team and delivery

| ID | Assumption | Confirm? |
|---|---|---|
| A-D1 | Three developers with full-stack capability will build this. | |
| A-D2 | The team uses GitHub as the central collaboration platform. | |
| A-D3 | Requirements are grouped so the team can work along natural seams with minimal blocking (G10). | |
| A-D4 | Operational intervention is performed out-of-band by the team, with no in-product admin role (§4.3). | |
| A-D5 | Architecture, task breakdown, and technology selection happen in a separate phase after this PRD is approved. | |
| A-D6 | The team can run the full auction lifecycle locally, including accelerated closing, for testing (NFR-MNT-03/04). | |

---

## 21. Product Decision Register

> ### ✅ There are ZERO unresolved product questions.
>
> Every question raised during PRD development has been answered. This section is the **decision register**: a single traceable list of all fifteen decisions, each pointing to the requirement that states it authoritatively.
>
> **No decision here may be reopened, reinterpreted, defaulted, or worked around during implementation.** If a genuinely new ambiguity is discovered while building — something this document does not address at all — it must be raised with the team and resolved as a product decision recorded here. It must never be silently invented in code.

### 21.1 The fifteen decisions

| # | Question | **Final decision** | Authoritative requirement |
|---|---|---|---|
| **Q1** | Can a seller cancel an active auction? | **No cancellation.** No cancel control, no cancellation rule, no `Cancelled` state. A published auction runs to its end time and closes. | BR-30 · FR-CREATE-25 · §12.0 · §12.4 |
| **Q2** | Can an auction have a minimum reserve price? | **No reserve price.** The highest valid bid wins regardless of amount. No hidden threshold, no "reserve not met" outcome. Sellers can set a higher starting price instead. | BR-35 · FR-END-05 |
| **Q3** | Can a seller edit a published auction? | **No editing after publication.** Name, description, starting price, end time, and image are immutable once published. | BR-31 · FR-CREATE-24 · FR-SEC-04 · FR-SEC-09 |
| **Q4** | Is there a minimum bid increment? | **No fixed increment.** Any amount meeting the minimum acceptable bid is valid — `+0.01 SAR` is as valid as `+1,000 SAR`. Never `+5 / +10 / +50`. | BR-32 · FR-BID-09 · EC-24 |
| **Q5** | What are the auction duration bounds? | **5 minutes to 7 days**, inclusive, measured from creation using server time. | BR-38 · FR-CREATE-09 · FR-CREATE-10 · FR-CREATE-10a |
| **Q6** | Must the first bid exceed the starting price? | **No — it may equal it.** `First Bid ≥ Starting Price`. Every bid after the first must be strictly greater than the current price. Explicit, documented special case. | BR-28 · BR-29 · FR-BID-06 · EC-23 |
| **Q7** | Should the end time extend for late bids (anti-sniping)? | **No anti-sniping.** The end time is fixed at creation and is never extended. Sniping is possible and accepted. | BR-36 · BR-16 · FR-END-01 |
| **Q8** | Must a user verify their email? | **No email verification.** A user may register and immediately browse, create, and bid. **A valid, unique email is still required at registration** — it is the login identifier and the only password-reset channel. | BR-37 · FR-AUTH-07 · FR-AUTH-07a · FR-AUTH-07b |
| **Q9** | How do the seller and winner make contact? | **They do not.** No chat, messaging, or contact exchange. The system displays the result and stops. | BR-34 · FR-END-17 · FR-DETAIL-21a · §19.0 |
| **Q10** | Should bid history be public? | **Public bid history**, visible on the auction to every viewer including unauthenticated visitors. Display names only — never emails. | BR-40 · FR-BID-22 · FR-BID-22a · FR-DETAIL-10 |
| **Q11** | Must display names be unique? | **Yes, unique across all accounts.** Validated at registration. The internal identifier remains the source of truth for attribution. | BR-39 · FR-PROF-03 · FR-PROF-03a · FR-PROF-03b |
| **Q12** | What currency, and what maximum price? | **Saudi Riyal (SAR)**, simulated demonstration values, no real money. **No maximum price and no bid ceiling** — none may be invented later. | BR-21 · BR-33 · FR-CREATE-07 · FR-CREATE-13 · FR-BID-08 · §19.0 |
| **Q13** | Should ended auctions appear in the main listing? | **Active auctions only.** Ended auctions are removed from the main listing but remain permanently accessible by direct link and via My Auctions / My Bids. | FR-LIST-05 · FR-LIST-05a · FR-LIST-06 · FR-END-12 |
| **Q14** | May a leading bidder bid again? | **Yes**, provided the new bid is strictly greater than the current valid price. Leading is never itself grounds for rejection. A UI warning is advised; the server must accept a qualifying bid. | BR-24 · FR-BID-04 · FR-BID-04a |
| **Q15** | Is password reset in the MVP? | **Yes — password reset is included.** Self-service, single-use, time-limited, non-enumerating. | M24 · FR-AUTH-25 → 31 · US-23 · SC-60 → 64 |

### 21.2 Accepted consequences of these decisions

Each decision below has a downside the team accepted deliberately. They are recorded so nobody mistakes them for oversights and "fixes" them in code.

| Decision | Accepted consequence | Why it is acceptable |
|---|---|---|
| **Q1 + Q3** — no cancellation, no editing | A mistaken listing cannot be corrected or removed by anyone (EC-26). Duplicate submissions are permanent (EC-21) | Deliberate fairness protection. Raises the importance of pre-submission clarity (FR-CREATE-26a) and duplicate prevention |
| **Q4 + Q12** — no increment, no ceiling | Penny-increment bid wars are possible (EC-24); one very large bid can dominate an auction (EC-25) | Values are simulated. No product requirement justifies either constraint. **Implementers must not add one** (SD-05) |
| **Q7** — no anti-sniping | A last-second bid can win with no chance to respond | A fixed end time is far simpler to close correctly, and correctness at close is a Must Have |
| **Q8** — no email verification | A user registering with an address they cannot access can never reset their password, and no Admin exists to help (§4.3) | Dalal holds nothing of real value (§19.0). FR-AUTH-07b requires the registration form to make the recovery role of the email clear |
| **Q9** — no contact system | The winner and seller cannot reach each other | There is nothing to arrange — no goods or money move (§19.0) |
| **Q10** — public bid history | Participation is visible to anyone on the internet | Core to the transparency promise. Display names only; registration must make this clear |
| **Q13** — active-only listing | Ended auctions lose listing-page visibility, so the platform shows no evidence of completed sales | The listing is a marketplace, not an archive. Ended auctions remain fully accessible by direct link (FR-LIST-05a) |
| **Q14** — leading bidder may re-bid | A user can bid against themselves and raise their own price | Only the amount governs validity. The advised UI warning mitigates accidental use |

### 21.3 Rule for implementation

> **`PRD.md` is the product source of truth.** Follow it.
>
> If implementation surfaces a genuinely new ambiguity — a situation this document does not address at all — **raise it with the team.** Do not pick a default, do not infer an answer from another product, and do not encode a guess. The resolution is recorded here first, then built.
>
> The distinction that matters: a **technical verification item** (does the platform support X?) is the architecture's business and is tracked in `ARCHITECTURE.md`. A **product decision** (what should the system do?) belongs here. A technical finding never silently rewrites a product requirement.

---


## 22. Future Enhancements

Post-MVP direction, grouped and roughly sequenced. **Nothing here is committed** — this exists so the MVP's boundaries are understood as deliberate rather than accidental, and so near-term decisions do not foreclose these paths.

### 22.1 Phase 1 — Close the loop (immediately after MVP)

The MVP determines a winner, displays the result, and stops. The most valuable next work deepens engagement within that loop — it does not extend the loop into commerce, which is Phase 3.

| Enhancement | Value | Notes |
|---|---|---|
| **Outbid notifications (N1)** | Highest-value single addition; brings bidders back, raises final prices | Email delivery already exists for password reset (§16.5), so the remaining cost is per-event design and preferences |
| **Won / ended notifications (N2, N3, N4)** | Closes the gap for absent users | Natural companion to N1 |
| **Anti-sniping time extension** | Fixes the most-cited fairness complaint of fixed-end auctions | **Explicitly not MVP (BR-36).** Would require reopening the fixed-end-time decision |
| **Relisting an unsold auction** | Sellers with no bids currently must recreate from scratch | Pairs with N5; partly compensates for having no editing (BR-31) |
| **Buyer–seller contact mechanism** | Would make the outcome actionable | **Explicitly not MVP (BR-34).** Only meaningful alongside Phase 3 commerce — there is nothing to arrange while no goods or money move |

*Password reset was listed here in v1.0. It is now MVP (M24) and has been removed from this table.*

### 22.2 Phase 2 — Auction depth

| Enhancement | Value | Notes |
|---|---|---|
| **Reserve prices** | Lets sellers list valuable items safely | **Explicitly not MVP (BR-35).** Adds a "reserve not met" outcome and hidden state |
| **Proxy / automatic bidding** | Bidders set a maximum and the system bids on their behalf | Significant bidding-engine change; only attempt once simple bidding is proven correct |
| **Minimum bid increments** | Cleaner bidding dynamics; shorter histories | **Explicitly not MVP (BR-32).** Would require reopening the decision |
| **Maximum bid ceiling** | Prevents one bid dominating an auction | **Explicitly not MVP (BR-21).** Would require a product decision recorded first |
| **Buy-it-now** | Immediate sale option alongside bidding | A second transaction path |
| **Scheduled auction start times** | Lets sellers prepare listings in advance | Introduces a real persisted Draft/Scheduled state |
| **Auction editing with rules** | Addresses seller typos safely | **Explicitly not MVP (BR-31).** Would need the fairness boundary drawn — likely description/image only, and only while there are zero bids |
| **Auction cancellation with rules** | Addresses seller mistakes | **Explicitly not MVP (BR-30).** Would need a `Cancelled` state and hidden-reserve protection — likely cancel-only-while-zero-bids |
| **Multiple images and video** | Better item evaluation | Straightforward extension of the image capability |

### 22.3 Phase 3 — Commerce

| Enhancement | Value | Notes |
|---|---|---|
| **Payment processing** | Turns the platform into a real marketplace | Largest single expansion; brings regulatory scope |
| **Escrow / settlement** | Protects both parties | Depends on payments |
| **Shipping and addresses** | Completes fulfilment | Depends on payments |
| **Fees and commission** | Enables a business model | A business decision first |
| **Refunds and dispute resolution** | Necessary once money moves | Requires admin tooling |
| **Invoicing and receipts** | Expected once payments exist | |

### 22.4 Phase 4 — Trust and scale

| Enhancement | Value | Notes |
|---|---|---|
| **Ratings and reviews** | Trust between strangers | Meaningful only after completed transactions |
| **Seller reputation** | Helps buyers assess risk | Depends on ratings |
| **Admin role and moderation tooling** | Required at public scale | Triggers defined in §4.3 |
| **Fraud and shill-bidding detection** | Protects auction integrity beyond BR-02 | Requires behavioral analysis |
| **Rate limiting and abuse prevention** | May partially land in MVP (SEC-R1) | |
| **Multi-factor authentication** | Necessary once accounts hold value | Follows payments |
| **Account deletion and data export** | Regulatory | |

### 22.5 Phase 5 — Reach and discovery

| Enhancement | Value | Notes |
|---|---|---|
| **Categories and taxonomy** | Navigation at volume | |
| **Search and faceted filtering** | Findability | Basic version is Should Have (S6) |
| **Watchlists and saved searches** | Re-engagement | Depends on notifications |
| **Recommendations** | Personalized discovery | Requires behavioral data |
| **Native mobile applications** | Better mobile experience, push notifications | **Explicitly out of MVP scope (§1.1).** The MVP is a responsive website and mobile browsers are fully supported. A native app would be a new platform, not an enhancement to this one |
| **Multi-language and multi-currency** | Geographic reach | Substantial cross-cutting work |
| **Public API** | Third-party integration | No identified consumer yet |
| **Analytics dashboards** | Seller and platform insight | |

### 22.6 Principles for evaluating future work

1. **Correctness first.** No enhancement may weaken the guarantees in §14 or the business rules in §9.
2. **The live loop is the product.** Anything that degrades real-time behavior or the reliability of closing is not worth the feature it buys.
3. **Sequence by dependency.** Ratings need transactions; transactions need payments; moderation needs admin. Building out of order produces half-features.
4. **Every addition must serve a product goal.** If a request does not map to §5 or a successor to it, it goes to the backlog by default (SD-02).

---

## PRD Readiness

### Assessment

> **This PRD is final. There are zero unresolved product questions. It is ready for architecture and for GitHub task planning.**

Version 1.0 raised fifteen product questions. Version 2.0 closed seven. **Version 3.0 closes the remaining eight.** Every one is now a finalized requirement with an authoritative ID, recorded in the decision register (§21.1) with its accepted consequences (§21.2).

### Readiness checklist

| # | Requirement for readiness | Status | Where it is defined |
|---|---|---|---|
| 1 | Core MVP scope is defined | ✅ | §7 — 24 Must Have items, 7 Should Have, explicit Future |
| 2 | Auction lifecycle is defined | ✅ | §12.0 — `Creation → Active → Bidding → Ended → Winner Determined → Result Displayed`; no Draft state, no Cancelled state |
| 3 | Seller permissions are defined | ✅ | §6 R3, §6.2 — cannot bid, edit, cancel, close, or alter the outcome |
| 4 | Bidding rules are defined | ✅ | §9.1 BR-01 → BR-08, §9.2 BR-28 → BR-32, §8.6 |
| 5 | First bid behavior is defined | ✅ | BR-28, BR-29, FR-BID-06, EC-23 — first bid may equal the starting price; explicit special case |
| 5a | **Auction duration is defined** | ✅ | **BR-38, FR-CREATE-09/10/10a — 5 minutes to 7 days inclusive** |
| 5b | **Leading-bidder behavior is defined** | ✅ | **BR-24, FR-BID-04/04a — may bid again if strictly greater** |
| 5c | **No reserve price** | ✅ | **BR-35, FR-CREATE-03** |
| 5d | **No anti-sniping; end time fixed** | ✅ | **BR-36, BR-16, SC-74** |
| 6 | Currency is defined as SAR | ✅ | BR-33, FR-CREATE-13, NFR-DAT-08 |
| 7 | Prices are clearly simulated/demo values | ✅ | Header callout, §1, §19.0, BR-33 — the term "Demo Points" is prohibited |
| 8 | Payment is explicitly out of scope | ✅ | §19.0, BR-34, SC-67 |
| 9 | Winner behavior is defined | ✅ | §8.8, BR-06, BR-09, FR-END-05 → 21a, US-16, US-17 |
| 10 | Authentication scope is defined | ✅ | §8.1 — registration, login, logout, auth state, identity, profile, password reset |
| 11 | Password reset is defined | ✅ | M24, FR-AUTH-25 → 31, US-23, SC-60 → 64, §16.5 |
| 11a | **Email verification behavior is defined** | ✅ | **BR-37, FR-AUTH-07/07a/07b — not required; valid unique email still required** |
| 11b | **Display names must be unique** | ✅ | **BR-39, FR-PROF-03/03a/03b, SC-69** |
| 11c | **Public bid history is defined** | ✅ | **BR-40, FR-BID-22/22a, SC-75** |
| 11d | **Listing scope is defined** | ✅ | **FR-LIST-05/05a/05b/06 — active auctions only; ended reachable by direct link** |
| 12 | Admin scope is defined | ✅ | §4.3 — no Admin role; triggers to revisit recorded; operational gap accepted |
| 13 | **All product decisions are resolved** | ✅ | **§21.1 — all fifteen closed. Zero open questions** |
| 14 | Requirements are internally consistent | ✅ | Full audit performed for this version; see below |
| 15 | Concurrency requirements preserved | ✅ | BR-11, BR-12, FR-BID-11 → 17, US-12, SC-16 → 19, NFR-MNT-02 — **unchanged and not weakened in any revision** |

### What the v3.0 consistency audit changed

Eight further decisions were applied and the whole document re-scanned. Changes in this revision:

| Decision | What changed in the document |
|---|---|
| **Q2** — no reserve | FR-CREATE-03 stops deferring it; BR-35 added; §19.2 and §22.2 marked "decided against" |
| **Q5** — 5 min to 7 days | **FR-CREATE-10 changed from 30 days to 7 days**; FR-CREATE-10a added; US-06, A-A6, SC-68 updated |
| **Q7** — no anti-sniping | BR-36 added; §19.2 and §22.1 marked "decided against"; SC-74 added |
| **Q8** — no email verification | FR-AUTH-07 rewritten; FR-AUTH-07a/07b added; BR-37 added; A-T2 resolved with its consequence recorded; SC-70 added |
| **Q10** — public bid history | FR-BID-22 rewritten; FR-BID-22a added; BR-40 added; A-B10 resolved; SC-75 added |
| **Q11** — unique display names | FR-PROF-03 rewritten; FR-PROF-03a/03b added; BR-39 added; A-T4 resolved; SC-69 added |
| **Q13** — active-only listing | **FR-LIST-05 rewritten**; FR-LIST-05a/05b added; FR-LIST-06 reordering simplified; US-08 and Flow 3 updated; S6 note corrected; SC-71 added |
| **Q14** — leading bidder may re-bid | FR-BID-04 rewritten; FR-BID-04a added; BR-24 restated as final; SC-72 added |
| **All** | §9.3 provisional-rules table emptied — `BR-P*` identifiers retired; §21 replaced by a decision register with zero open questions |

### What the earlier v2.0 audit changed

The document was scanned for statements contradicting the first seven decisions. Obsolete references removed:

| Removed | Replaced by |
|---|---|
| `Cancelled` state and its conditional §12.4 extension | BR-30; §12.4 is now a "must NOT be built" list |
| Auction editing, conditional editing, and seller edit screens | BR-31, FR-CREATE-24, FR-SEC-04, FR-SEC-09 |
| Fixed / percentage bid increments; Should-Have item S4 | BR-32, FR-BID-09 — S4 withdrawn |
| Maximum price and the 1,000,000 ceiling | BR-21, FR-CREATE-07, FR-BID-08, SEC-R3 — no ceiling, with the consequence recorded |
| "First bid must exceed the starting price" | BR-28, BR-29, FR-BID-06 |
| Seller/winner contact, off-platform settlement | BR-34, FR-END-17, FR-DETAIL-21a |
| Password reset as an excluded / future item | M24, FR-AUTH-25 → 31 |
| Provisional rules BR-P1, BR-P3, BR-P4 | Promoted to BR-30, BR-31, BR-32 |
| Unpriced or currency-neutral amounts | SAR throughout, with simulated-value framing |

The term **"Demo Points" is never used to describe a price** anywhere in this document — it appears only in the prohibitions above (§19.0) — and it must not be introduced into the product.

### What is deliberately still not decided

**No technology, no schema, no API surface, no implementation plan, no task assignment** — these belong to other documents and phases.

**Zero product questions remain open.** Every one of the fifteen is closed (§21.1). Anything still marked "to verify" in `ARCHITECTURE.md` is a **technical platform question**, not a product question — the distinction is stated in §21.3 and must be maintained. A technical finding never silently rewrites a product requirement.

### Remaining risks — recorded, not blocking

All are accepted consequences of finalized decisions, catalogued in full at §21.2. The most significant:

| Risk | Consequence | Why it is accepted |
|---|---|---|
| **No price ceiling** (BR-21) | A very large bid can dominate an auction for its remaining duration | Values are simulated; no product requirement justifies a ceiling. Implementers must not invent one (SD-05) |
| **No editing, no cancellation** (BR-30, BR-31) | A mistaken listing cannot be corrected or removed by anyone | Deliberate fairness decision. Raises the importance of duplicate-submission prevention (EC-21) and pre-submission clarity (FR-CREATE-26a) |
| **No email verification** (BR-37) | A user registering with an unreachable address can never reset their password, and no Admin exists to help | Dalal holds nothing of real value. FR-AUTH-07b requires the form to make the recovery role of the email clear |
| **No anti-sniping** (BR-36) | A last-second bid can win with no chance to respond | A fixed end time is far simpler to close correctly |
| **Active-only listing** (FR-LIST-05) | The platform shows no evidence of completed sales on its main page | The listing is a marketplace, not an archive. Ended auctions stay reachable by direct link |
| **No Admin role** (§4.3) | No in-product route to remove abusive content | Handled out-of-band at demonstration scale |
| **No notifications** (§16) | A user outbid while away learns of it only on return | Engagement, not correctness. Password reset is the sole outbound email (§16.5) |

### Natural workstream seams

Unchanged from v1.0: identity and access (§8.1, §8.2); auction creation and media (§8.3); browsing and detail presentation (§8.4, §8.5); bidding and server-side validation (§8.6); real-time delivery (§8.7, §13); and closing and results (§8.8). The main cross-cutting dependency is the shared definition of auction and bid state, which the architecture phase should agree first. *(Division of work is a separate phase.)*

### Recommended next steps

1. **Approve this PRD as final.** No product decisions remain to be made.
2. **Confirm `TEAM.md` and `ARCHITECTURE.md` are synchronized with this version** — both were revised alongside it.
3. **Proceed to GitHub task planning and Sprint 0.**
4. Resolve the **technical** verification items in `ARCHITECTURE.md` §22 during Sprint 0. These are platform questions, not product questions.

**Not started:** implementation, database schema, SQL, API specifications, Supabase configuration, GitHub Actions, and GitHub Issues.
