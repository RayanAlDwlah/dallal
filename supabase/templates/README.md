# Auth email templates

Five Arabic RTL templates for the emails Supabase Auth sends on behalf of Dalal.
Supabase's defaults are English, left-to-right, and carry Supabase's own wording —
which is what production sent until these were written.

| file | dashboard slot | subject |
|---|---|---|
| `confirm-signup.html` | Confirm sign up | `أكّد حسابك في دلال` |
| `reset-password.html` | Reset password | `إعادة تعيين كلمة المرور — دلال` |
| `magic-link.html` | Magic link or OTP | `رابط دخولك إلى دلال` |
| `change-email.html` | Change email address | `أكّد تغيير بريدك — دلال` |
| `reauthentication.html` | Reauthentication | `رمز التحقق: {{ .Token }}` |

Each file's own header comment names the variables Supabase substitutes into it and
the app code that triggers it. Read that before editing one.

---

## The order is not negotiable: SMTP first, templates second

The dashboard's Templates tab is **locked** until custom SMTP is saved. It says so
in a banner: *"Set up custom SMTP to edit templates — Emails will be sent using the
default templates."* Pasting the HTML is not possible before then, so:

1. **Brevo** → Settings → SMTP & API → SMTP → **Generate an SMTP key**. Copy it once;
   Brevo does not show it again.
2. **Supabase** → Authentication → Emails → **SMTP Settings**. Fill the form (values
   below), paste the key into **Password**, **Save changes**.
3. **Supabase** → Authentication → Emails → **Templates**. The five slots are now
   editable. For each: paste the file's full contents into the body, set the subject
   from the table above, save.

## Brevo, verified against app.brevo.com on 2026-08-16

| field | value |
|---|---|
| Host | `smtp-relay.brevo.com` |
| Port | `587` |
| Username | a `b…@smtp-brevo.com` address — **not** the sender address |
| Password | the generated SMTP key |
| Sender email | `rayanaldwlah@gmail.com` (Brevo status: **Verified**, Default) |
| Sender name | `دلال` |
| Minimum interval per user | `10` seconds |

The interval defaults to **60**. Ten is deliberate: the default blocks a second
signup or reset for the same address inside a minute, which is exactly the shape of
a live demo where somebody retries.

**The username and the key are not in this repository, and must not be.** The
repository is public (`CLAUDE.md` §6). They live in the Supabase dashboard, which
encrypts them, and in a password manager. `supabase/config.toml` references both as
`env(BREVO_SMTP_LOGIN)` / `env(BREVO_SMTP_KEY)` and is commented out, because
`supabase start` uses the local Inbucket at `[local_smtp]` and needs no relay.

### Deliverability: the sender is a gmail.com address, and Brevo says so

Brevo flags it — *"Freemail domain is not recommended"* — and it is right. Nobody can
publish DKIM or SPF for `gmail.com`, so mail sent as `rayanaldwlah@gmail.com` through
Brevo's shared IP is unaligned, and Gmail and Outlook route unaligned mail to spam
more often than they reject it. It **works**, and it is fine for a demo. It is not
fine for real users.

The fix is a domain, not a setting: verify one in Brevo (Senders, domains, IPs →
Domains), let Brevo hand you the DKIM and DMARC records, publish them at the
registrar, then change the sender to `no-reply@<that domain>`. Nothing in these
templates changes when that happens.

**Check the spam folder before concluding an email was not sent.** Brevo's
Transactional → Logs page shows whether it left Brevo at all, which separates "our
config is wrong" from "the inbox filed it".

---

## Only one of these five actually fires today

Measured on `dallal-prod` on 2026-08-16, not assumed:

| template | fires today? | why |
|---|---|---|
| `reset-password.html` | **yes** | `app/(auth)/actions.ts:118` calls `resetPasswordForEmail` |
| `confirm-signup.html` | no | **Confirm email is OFF** (Authentication → Sign In / Providers). Signup completes instantly and sends nothing |
| `change-email.html` | no | no email-change screen in the app yet |
| `magic-link.html` | no | no `signInWithOtp` call anywhere |
| `reauthentication.html` | no | `secure_password_change` is off |

So **verify the setup with a password reset**, not a signup — a signup proves nothing
about SMTP, because no mail is sent at all.

**Turning "Confirm email" on is a product decision, not a setting.** It puts an email
in front of every new account before that account can bid, and this project sends from
a freemail address on a shared IP (above). During a demo window that is a way to lock
your audience out of the product while everyone stares at a spam folder. Whoever turns
it on should say so out loud first — `CLAUDE.md` §8 and `TEAM.md` rule 16.

---

## What is deliberately not here

The dashboard lists more slots than this directory fills. The absences are decisions,
not an unfinished list:

- **Invite user** — there is no invite flow in the app. Nothing sends it.
- **Password changed / Email address changed / Phone number changed / Sign-in method
  linked / Sign-in method removed / MFA method added / MFA method removed** — these
  are Supabase's *security notification* family and are opt-in. Dalal enables none of
  them, has no phone auth and no MFA, and a template for an email nobody sends is a
  file that rots.

If one of those is ever turned on, it will send **Supabase's English default** until
someone writes the Arabic. That is the whole reason `magic-link.html` exists despite
the app having no `signInWithOtp` call today — writing it cost one file; discovering
an English email during a demo costs the demo.

## Why the HTML looks like it was written in 2005

Tables, inline styles, no flexbox, no grid, no web fonts. Outlook renders with Word's
engine, Gmail strips most of a `<style>` block, and `@font-face` never loads. The app's
own CSS does not exist here — an email carries its own or it carries nothing.

`CLAUDE.md` §3 still governs: `dir="rtl"` is on `<html>`, on `<body>` and on **every**
table, because a client that drops one usually keeps another; digits stay Western; and
every URL and the OTP code sit in a `dir="ltr"` isolate, because an RTL container
reorders a Latin string's punctuation and the reader copies a broken link or types a
scrambled code with no idea why.

These files are **not** checked by `tests/guards/run.sh`. Its `dir="rtl"`-exactly-once
rule is scoped to `.ts`/`.tsx` and its target is the React tree, where a second
declaration is a real bug. A standalone HTML document is outside that scope by design —
so nothing mechanical watches these five. Read them.
