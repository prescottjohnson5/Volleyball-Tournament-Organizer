# Deploy on AWS: one free-tier server and a `.click` domain

The app runs on one small EC2 server. Caddy puts HTTPS in front of it (it gets the certificate by
itself), pm2 keeps the app running across crashes and reboots, and Route 53 provides the domain.
Supabase stays where it is: the server only needs its keys.

**Cost:**
- **Domain:** a few dollars a year. Route 53 shows the price before you buy.
- **DNS zone:** $0.50 a month.
- **Server:** covered by the free tier.
- **Fixed public IP:** about $3.60 a month once any free-tier allowance or credit runs out.

Do step 1 first, so AWS warns you before anything costs money.

Replace `yourdomain.click` everywhere below with your real domain.

## Before you start

- **Supabase works locally.** With `npm run dev` running, <http://localhost:3000/setup> shows no
  "Fix" lines.
- **Your latest code is on GitHub.** Run `git push`.

## 1. Budget alert (2 minutes)

1. In the AWS console, open **Billing and Cost Management → Budgets → Create budget**.
2. Choose **Use a template → Zero spend budget**, enter your email, and click **Create budget**.

## 2. Buy the domain (5 minutes, then up to 30 minutes to activate)

1. Open **Route 53 → Domains → Registered domains → Register domains**.
2. Search for `yourdomain.click`, add it to the cart and check out.

Route 53 also creates the domain's DNS settings (a *hosted zone*).

## 3. Launch the server

Open **EC2 → Instances → Launch instances** and set:

- **Name:** `volleyball`.
- **Image:** Ubuntu Server 24.04 LTS.
- **Instance type:** the one marked **Free tier eligible** (`t3.micro` or `t2.micro`).
- **Key pair:** **Create new key pair**, keep the defaults, and save the file somewhere safe. You may
  never need it, but you cannot download it again.
- **Network settings:**
  - Tick **Allow SSH traffic from → My IP**.
  - Tick **Allow HTTPS traffic from the internet**.
  - Tick **Allow HTTP traffic from the internet**.
- **Storage:** 20 GiB (the free tier allows up to 30).

Click **Launch instance**.

## 4. Give it a fixed address

1. Open **EC2 → Elastic IPs → Allocate Elastic IP address → Allocate**.
2. Select the new address, then click **Actions → Associate Elastic IP address**.
3. Pick the `volleyball` instance and click **Associate**.

Note the address, for example `3.91.20.15`.

## 5. Point the domain at the server

1. Open **Route 53 → Hosted zones → yourdomain.click → Create record**.
2. Leave **Record name** empty, keep **Record type** as **A**, and put the Elastic IP in **Value**.
3. Click **Create records**.

## 6. Open a terminal on the server

In **EC2 → Instances**, select `volleyball`, then click **Connect → EC2 Instance Connect → Connect**.
A terminal opens in your browser.

Every command below goes into that terminal. Paste with **Ctrl+Shift+V**.

## 7. Install Node.js, Caddy and pm2

```bash
# 2 GB of swap, so `npm run build` does not run out of memory on a 1 GB server
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs git caddy
sudo npm install -g pm2
node --version   # v24.x
```

## 8. Download, configure and build the app

```bash
git clone https://github.com/prescottjohnson5/Volleyball-Tournament-Organizer.git
cd Volleyball-Tournament-Organizer
nano .env.local
```

If the repository is private, `git clone` asks you to sign in. Use your GitHub username, and a
[personal access token](https://github.com/settings/tokens) (read access to the repo is enough) as
the password.

**Fill in `.env.local`:**

1. In nano, paste the same lines as your local `.env.local`, with one change:

   ```
   NEXT_PUBLIC_APP_URL=https://yourdomain.click
   ```

2. Save with **Ctrl+O** then **Enter**, and exit with **Ctrl+X**.

**Lock the file and build:**

```bash
chmod 600 .env.local        # only you can read the keys
npm ci
npm run build               # takes a few minutes on this server
```

## 9. Start the app and keep it running

```bash
pm2 start npm --name volleyball -- start
pm2 save
pm2 startup
```

`pm2 startup` prints one command that starts with `sudo env PATH=...`. Copy it, paste it, and run it,
so the app starts again after a reboot.

## 10. Turn on HTTPS

```bash
sed 's/yourdomain.click/YOUR-REAL-DOMAIN.click/' deploy/Caddyfile | sudo tee /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy fetches the HTTPS certificate on its own. This only works once the domain from step 5 points at
the server, which can take a few minutes. If <https://yourdomain.click> does not load yet, wait 5
minutes, then run `sudo systemctl reload caddy` again.

## 11. Tell Supabase about the live address

In Supabase, open **Authentication → URL Configuration**:

- **Site URL:** `https://yourdomain.click`.
- **Redirect URLs:** add `https://yourdomain.click/**`. Keep `http://localhost:3000/**` so local
  testing still works.

## 12. Daily cleanup (only for the online sandbox)

You can skip this step unless you switched on anonymous sign-ins for the 24-hour online sandbox. The
browser sandbox needs no cleanup.

1. Run `crontab -e` (choose `nano` if it asks).
2. Add this line, then save:

   ```
   0 4 * * * cd ~/Volleyball-Tournament-Organizer && curl -fsS -H "Authorization: Bearer $(grep '^CRON_SECRET=' .env.local | cut -d= -f2-)" http://localhost:3000/api/cron/cleanup > /dev/null
   ```

It reads `CRON_SECRET` from `.env.local`, so the secret is not copied anywhere else.

## 13. Check it

1. Open <https://yourdomain.click/setup>. Every line should say **OK** or **Note**, and none should
   say **Fix**.
2. On your phone, open <https://yourdomain.click> and try each path:
   - **Create a Tournament** → **Continue without an account**: the sandbox.
   - **Create a Tournament** → sign up: a real tournament.
   - **View a Tournament**.

## Updating the site later

Push your changes to GitHub, then run this on the server:

```bash
~/Volleyball-Tournament-Organizer/deploy/update.sh
```

It pulls, installs, builds and restarts, then checks that the app answers. The site may be slow or
show errors for the minute the build takes.

`NEXT_PUBLIC_` values are built into the pages. **After editing `.env.local` on the server, run the
update script** (or `npm run build && pm2 restart volleyball`); a restart alone is not enough.

## If something is wrong

| What you see | What to do |
| --- | --- |
| The page does not load at all | Check that steps 4 and 5 used the same Elastic IP, and that the instance allows HTTP and HTTPS (EC2 → Instances → Security). Then run `sudo systemctl status caddy`. |
| "502 Bad Gateway" | The app is not running. Run `pm2 status`, then `pm2 logs volleyball --lines 50`. |
| `npm run build` stops with "Killed" | The server ran out of memory. Check that swap is on with `free -h`, and redo the swap lines in step 7. |
| Sign-up or email links open `localhost` | Set the Site URL in step 11, and `NEXT_PUBLIC_APP_URL` in `.env.local`, then run the update script. |
| A page says "not connected yet", or `/setup` shows **Fix** | Correct the named variable in `.env.local`, then run the update script. |
| Supabase was working but now fails | Free Supabase projects pause after a week without use. Restore the project from the Supabase dashboard. |

The keys live only in `.env.local` on the server. The file is in `.gitignore`, so `git pull` never
touches it and it is never committed.
