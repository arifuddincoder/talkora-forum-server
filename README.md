# 🛠️ Talkora Server - Backend for MERN Forum Platform

The **Talkora Server** is a secure and scalable backend API for the Talkora Forum Platform. Built with **Node.js**, **Express.js**, **MongoDB**, and **JWT Authentication**, it supports user management, post creation, comments, announcements, Stripe payment, role-based access, and more.

---

## 🔗 Live Website

🌐 [https://b11a12-talkora.web.app](https://b11a12-talkora.web.app)

## 🧾 Repositories

- 🗂️ **Client GitHub:** [https://github.com/arifuddincoder/talkora-forum-client](https://github.com/arifuddincoder/talkora-forum-client)  
- ⚙️ **Server GitHub:** [https://github.com/arifuddincoder/talkora-forum-server](https://github.com/arifuddincoder/talkora-forum-server)  
- 🌐 **Main API:** [https://b11a12-talkora-server.vercel.app/](https://b11a12-talkora-server.vercel.app/)

---

## 🔐 Key Backend Features

- ✅ JWT-based Authentication & Cookie Token Storage
- ✅ Role-based Authorization (User / Admin)
- ✅ RESTful API for Posts, Comments, Tags, Reports, Announcements
- ✅ Stripe Payment Integration for Membership
- ✅ Post Visibility & Voting (Upvote/Downvote)
- ✅ User Profile & Membership Tracking
- ✅ Aggregation Pipelines for Popularity Sorting & Tag Counts
- ✅ Search Logging & Popular Searches API
- ✅ Reported Comments Moderation with Feedback

---

## 📁 Project Structure

```
/index.js               → Main Express App
/vercel.json            → Vercel Deployment Config
.env                    → Environment Variables (not uploaded)
/node_modules           → Node Dependencies
```

---

## 📦 Dependencies Used

| Package         | Purpose                             |
|----------------|-------------------------------------|
| express         | Web server routing                  |
| cors            | Cross-Origin Resource Sharing       |
| dotenv          | Environment variable loader         |
| mongodb         | Database driver                     |
| jsonwebtoken    | Authentication & Authorization      |
| cookie-parser   | Parse cookies from HTTP requests    |
| stripe          | Stripe payment integration          |

---

## 🧪 Environment Variables

```env
PORT=3000
MONGODB_URI=your_mongo_uri
ACCESS_TOKEN_SECRET=your_jwt_secret
STRIPE_SECRET_KEY=your_stripe_key
```

---

## 🔐 Authentication & Security

- JWT token is generated on login and stored in cookies (HttpOnly, SameSite, Secure)
- Middleware `verifyToken` validates user token
- Middleware `verifyAdmin` protects admin-only routes
- User role managed via `users` collection

---

## 📊 Admin API Highlights

- `/admin/overview` → Total posts, comments, users
- `/users` → Paginated + searchable user list
- `/users/role/:id` → Make Admin
- `/announcements` → Create, List, Delete
- `/tags` → Add and fetch tags
- `/reported-comments` → Fetch, Delete, Ignore reported comments

---

## 📝 Post & Comment Features

- `GET /posts` → Filter by tags, sort by popularity, pagination
- `GET /posts/:id` → Post details with comment count
- `POST /posts` → Add new post (limit handled by client)
- `PATCH /posts/:id/vote` → Upvote/Downvote logic with toggle
- `DELETE /posts/:id` → Delete post (only if owner)
- `GET /comments?postId=...` → Public comment list
- `POST /comments` → Add a comment
- `PATCH /report-comment/:id` → Report comment with feedback
- `GET /secure-comments/:postId` → Protected comment fetch

---

## 💳 Payment Integration

- `POST /create-payment-intent` → Stripe payment intent
- `POST /payments` → Save payment record
- `PATCH /users/membership/:email` → Grant membership & badge

---

## 🔍 Search & Analytics

- `POST /searches` → Log user search
- `GET /popular-searches` → Top 3 search keywords
- `GET /tags-with-counts` → Popular tags with post counts

---

## 🛡️ Deployment

- ✅ Hosted on **Vercel** using `vercel.json`
- ✅ CORS configured for frontend domain
- ✅ Refresh-safe routing enabled
- ✅ Secure token handling in cookies

---

## 👑 Admin Access

- **Email:** `rafiq.ahmed@mailinator.com`  
- **Password:** `Pa$$w0rd!`

---

## 👤 General User Access

- **Email:** `david.kim@mailinator.com`  
- **Password:** `Pa$$w0rd!`

---

## 🔗 Project Links

- 🌐 **Live URL:** [https://b11a12-talkora.web.app](https://b11a12-talkora.web.app)  
- 🧾 **Client GitHub:** [https://github.com/arifuddincoder/talkora-forum-client](https://github.com/arifuddincoder/talkora-forum-client)  
- 🧾 **Server GitHub:** [https://github.com/arifuddincoder/talkora-forum-server](https://github.com/arifuddincoder/talkora-forum-server)  

---


## 👨‍💻 Developer Info

**Md Arif Uddin**  
📧 arifuddincoder@gmail.com  
🌐 [https://codebyarif.web.app](https://codebyarif.web.app)  
🔗 [GitHub](https://github.com/arifuddincoder) | [LinkedIn](https://linkedin.com/in/arifuddincoder)