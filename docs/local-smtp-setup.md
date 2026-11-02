# Confirmation email setup for local provider testing

Supabase's default email service sends only to project-team addresses. Reviewer
email confirmation and MFA passed with that service. Brevo custom SMTP is now
configured. An initial HTTP 504 occurred with incorrect port/login settings;
after correction, the real owner signup UI returned HTTP 201 and the provider
created one unconfirmed account with confirmation requested. Inbox delivery and
following the owner's confirmation link remain pending. App hosting stays on the PC.

## Testing before a domain is available

Brevo supports verifying an individual sender email address. Its documented
temporary handling for free email addresses rewrites the sender to a compliant
Brevo address. This is a development option, not domain authentication or proof
of production deliverability. New transactional accounts may need provider
activation before sending is enabled. No paid plan is required for this setup.

Email-address verification and domain authentication are different steps. A
Gmail sender can be verified with Brevo's email code; its `gmail.com` domain
cannot be authenticated by the user because they do not control Google's DNS.
Brevo documents DKIM/DMARC warnings for free sender domains even after the sender
email has been verified. An authentication warning alone does not establish
that sender verification or SMTP sending is blocked. Check the actual sender
status and error before changing providers or requesting another credential.
The temporary route below has not yet passed real email delivery for this
workspace. If Brevo requires an owned domain or account activation, that remains
an external setup dependency; do not present sender rewriting as guaranteed.

1. Create a free Brevo account and verify its account email.
2. In Brevo, open **Settings > Senders, Domains, IPs > Senders > Add a sender**.
   Use **Coteacher Test** as the sender name and an email address you control.
   Enter Brevo's verification code in Brevo to verify that sender.
3. Open **Settings > SMTP & API > SMTP**. Copy the displayed **SMTP login** and
   generate a dedicated **SMTP key** for Coteacher. The SMTP key is different
   from a Brevo API key and from your personal account password.
4. In the Supabase project, open **Authentication > SMTP Settings** (under the
   email settings) and enable custom SMTP. Fill the settings below.

| Supabase setting | Value |
| --- | --- |
| Sender email | The exact email address verified as a Brevo sender |
| Sender name | `Coteacher Test` |
| Host | `smtp-relay.brevo.com` |
| Port | `587` |
| Username | The SMTP login displayed by Brevo |
| Password | The dedicated Brevo SMTP key |

Save these credentials directly in Supabase. Do not paste them in chat, commit
them, use a frontend `VITE_` variable or replace the working Supabase/R2 keys.
Keep email confirmation enabled. The three loopback callback URLs and R2 CORS
policy already configured for the local apps remain necessary.

## Verification

After saving, use a separate adult school-owner test account whose email you
control, in a private browser window so the reviewer stays signed in separately.
Register at `http://127.0.0.1:5175`, receive and follow the confirmation email,
sign in and complete the owner's authenticator setup. Do not use a child's
personal data. Successful signup alone does not prove inbox delivery.

If signup is rejected, inspect the Supabase Auth and Brevo transactional logs.
If Brevo reports that transactional sending is not activated, complete its
activation process before retrying. Do not disable email verification to bypass
SMTP configuration. Record real confirmation, recovery and subsequent sign-in
separately from simulated tests.

For public release, use a domain you control with the sending provider's DKIM
and DMARC setup, and verify actual delivery. The temporary sender rewrite above
does not complete that release requirement.

## Provider instructions

- [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Brevo sender verification](https://help.brevo.com/hc/en-us/articles/208836149-Create-a-new-sender-From-name-and-From-email)
- [Brevo SMTP settings](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP)
- [Brevo temporary sender rewriting](https://help.brevo.com/hc/en-us/articles/14925263522578-Comply-with-Gmail-Yahoo-and-Microsoft-s-requirements-for-email-senders)
