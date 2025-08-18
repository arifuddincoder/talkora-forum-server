require("dotenv").config();
const express = require("express");

const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const cors = require("cors");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");

const port = process.env.PORT || 3000;
const app = express();

const corsOptions = {
	origin: ["https://b11a12-talkora.web.app"],
	credentials: true,
	optionSuccessStatus: 200,
};

app.use(cors(corsOptions));

app.use(express.json());
app.use(cookieParser());

let usersCollection;

const verifyToken = (req, res, next) => {
	const token = req.cookies?.token;
	if (!token) {
		return res.status(401).send({ message: "unauthorized access" });
	}
	jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
		if (err) {
			console.log("JWT Error:", err);
			return res.status(401).send({ message: "unauthorized access" });
		}
		req.user = decoded;
		next();
	});
};

const verifyAdmin = async (req, res, next) => {
	try {
		const email = req.user?.email;
		if (!email) return res.status(401).send({ message: "Unauthorized" });

		const user = await usersCollection.findOne({ email });
		if (!user || user.role !== "admin") {
			return res.status(403).send({ message: "Forbidden: Admins only" });
		}
		next();
	} catch (error) {
		console.error("verifyAdmin error:", error);
		res.status(500).send({ message: "Server error in verifyAdmin" });
	}
};

const client = new MongoClient(process.env.MONGODB_URI, {
	serverApi: {
		version: ServerApiVersion.v1,
		strict: true,
		deprecationErrors: true,
	},
});

async function run() {
	try {
		const db = client.db("b11a12-talkora");
		const postsCollection = db.collection("posts");
		const commentsCollection = db.collection("comments");
		const tagsCollection = db.collection("tags");
		const announcementsCollection = db.collection("announcements");
		const paymentsCollection = db.collection("payments");
		const searchesCollection = db.collection("searches");
		usersCollection = db.collection("users");

		app.get("/admin/overview", verifyToken, verifyAdmin, async (req, res) => {
			try {
				const posts = await postsCollection.estimatedDocumentCount();
				const comments = await commentsCollection.estimatedDocumentCount();
				const users = await usersCollection.estimatedDocumentCount();

				res.send({ posts, comments, users });
			} catch (error) {
				console.error("Admin overview error:", error);
				res.status(500).send({ message: "Failed to load stats" });
			}
		});

		app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
			const search = req.query.search || "";
			const page = parseInt(req.query.page) || 0;
			const limit = parseInt(req.query.limit) || 10;

			const query = {
				$or: [{ name: { $regex: search, $options: "i" } }, { email: { $regex: search, $options: "i" } }],
			};

			const cursor = usersCollection.find(query);
			const total = await usersCollection.countDocuments(query);
			const users = await cursor
				.skip(page * limit)
				.limit(limit)
				.sort({ created_at: -1 })
				.toArray();

			res.send({ total, users });
		});

		app.patch("/users/role/:id", verifyToken, verifyAdmin, async (req, res) => {
			const { id } = req.params;
			const { role } = req.body;
			const result = await usersCollection.updateOne({ _id: new ObjectId(id) }, { $set: { role } });
			res.send(result);
		});

		app.post("/tags", verifyToken, verifyAdmin, async (req, res) => {
			try {
				const { name } = req.body;

				if (!name) {
					return res.status(400).send({ message: "Tag name is required" });
				}

				const existingTag = await tagsCollection.findOne({ name: name.toLowerCase() });

				if (existingTag) {
					return res.status(409).send({ message: "Tag already exists" });
				}

				const result = await tagsCollection.insertOne({ name: name.toLowerCase() });

				res.send({ success: true, insertedId: result.insertedId });
			} catch (error) {
				console.error("Failed to insert tag:", error);
				res.status(500).send({ message: "Internal server error" });
			}
		});

		app.get("/reported-comments", verifyToken, verifyAdmin, async (req, res) => {
			try {
				const page = parseInt(req.query.page) || 0;
				const limit = parseInt(req.query.limit) || 10;

				const query = { reported: true };

				const comments = await commentsCollection
					.find(query)
					.sort({ created_at: -1 })
					.skip(page * limit)
					.limit(limit)
					.toArray();

				const total = await commentsCollection.countDocuments(query);

				res.send({ comments, total });
			} catch (error) {
				console.error("Failed to fetch reported comments:", error.message);
				res.status(500).send({ message: "Failed to fetch reported comments" });
			}
		});

		app.delete("/comments/:id", verifyToken, verifyAdmin, async (req, res) => {
			const id = req.params.id;
			const result = await commentsCollection.deleteOne({ _id: new ObjectId(id) });
			res.send(result);
		});

		app.patch("/ignore-report/:id", verifyToken, verifyAdmin, async (req, res) => {
			const id = req.params.id;
			const result = await commentsCollection.updateOne(
				{ _id: new ObjectId(id) },
				{ $unset: { feedback: "", reported: "" } }
			);
			res.send(result);
		});

		app.get("/users/profile", verifyToken, async (req, res) => {
			try {
				const email = req.user.email;

				if (!email) {
					return res.status(403).json({ success: false, message: "Unauthorized access" });
				}

				const user = await usersCollection.findOne({ email });

				if (!user || user.email !== email) {
					return res.status(403).json({ success: false, message: "Forbidden access" });
				}

				res.send({
					name: user.name,
					email: user.email,
					image: user.image,
					badge: user.badge,
					created_at: user.created_at,
					last_login_time: user.last_login_time,
				});
			} catch (error) {
				console.error("Error in /users/profile:", error.message);
				res.status(500).json({ success: false, message: "Internal server error" });
			}
		});

		app.get("/posts/my-recent", verifyToken, async (req, res) => {
			const email = req.user.email;
			const posts = await postsCollection.find({ authorEmail: email }).sort({ created_at: -1 }).limit(3).toArray();

			res.send(posts);
		});

		app.get("/announcements", verifyToken, verifyAdmin, async (req, res) => {
			try {
				const page = parseInt(req.query.page) || 0;
				const limit = parseInt(req.query.limit) || 10;

				const cursor = announcementsCollection.find().sort({ created_at: -1 });
				const total = await announcementsCollection.countDocuments();
				const announcements = await cursor
					.skip(page * limit)
					.limit(limit)
					.toArray();

				res.send({ total, announcements });
			} catch (error) {
				console.error("Error fetching announcements:", error);
				res.status(500).send({ message: "Failed to fetch announcements" });
			}
		});

		app.post("/announcements", verifyToken, verifyAdmin, async (req, res) => {
			try {
				const announcement = req.body;
				if (
					!announcement?.title ||
					!announcement?.description ||
					!announcement?.authorName ||
					!announcement?.authorImage
				) {
					return res.status(400).send({ message: "All fields are required" });
				}
				announcement.created_at = new Date();
				const result = await announcementsCollection.insertOne(announcement);
				res.send({ success: true, insertedId: result.insertedId });
			} catch (error) {
				console.error("Error adding announcement:", error);
				res.status(500).send({ message: "Failed to add announcement" });
			}
		});

		app.delete("/announcements/:id", verifyToken, verifyAdmin, async (req, res) => {
			try {
				const id = req.params.id;
				const result = await announcementsCollection.deleteOne({ _id: new ObjectId(id) });
				res.send(result);
			} catch (error) {
				console.error("Error deleting announcement:", error);
				res.status(500).send({ message: "Failed to delete announcement" });
			}
		});

		app.post("/users", async (req, res) => {
			try {
				const user = req.body;
				if (user?.email) {
					user.email = user.email.toLowerCase();
				}
				if (!user?.email || !user?.name || !user?.image) {
					return res.status(400).send({ success: false, message: "Name, email, and photo are required" });
				}
				const existingUser = await usersCollection.findOne({ email: user.email });
				if (existingUser) {
					return res.send({ success: true, existing: true, message: "User already exists", email: user.email });
				}
				user.role = typeof user.role === "string" ? user.role : "user";
				user.created_at = new Date().toISOString();
				user.last_login_time = new Date().toISOString();
				const result = await usersCollection.insertOne(user);
				res.send({ success: true, insertedId: result.insertedId });
			} catch (error) {
				console.error("Error creating user:", error);
				res.status(500).send({ success: false, message: "Failed to create user" });
			}
		});

		app.patch("/users/:email", verifyToken, async (req, res) => {
			try {
				const email = req.params.email;
				const updateDoc = {
					$set: { last_login_time: req.body.last_login_time || new Date().toISOString() },
				};
				const result = await usersCollection.updateOne({ email }, updateDoc);
				if (result.modifiedCount > 0) {
					res.send({ success: true, message: "Last login time updated" });
				} else {
					res.status(404).send({ success: false, message: "User not found or not updated" });
				}
			} catch (error) {
				console.error("Error updating login time:", error);
				res.status(500).send({ success: false, message: "Failed to update login time" });
			}
		});

		app.get("/users/role/:email", verifyToken, async (req, res) => {
			try {
				const email = req.params.email.toLowerCase();
				const user = await usersCollection.findOne({ email });
				if (!user) {
					return res.send({ success: false, role: "user", message: "User not found" });
				}
				res.send({ success: true, role: user.role || "user" });
			} catch (error) {
				console.error("Error fetching user role:", error);
				res.status(500).send({ success: false, message: "Failed to fetch user role" });
			}
		});

		app.post("/create-payment-intent", verifyToken, async (req, res) => {
			const { price } = req.body;
			const amount = parseInt(price * 100);

			try {
				const paymentIntent = await stripe.paymentIntents.create({
					amount,
					currency: "usd",
					payment_method_types: ["card"],
				});

				res.send({ clientSecret: paymentIntent.client_secret });
			} catch (err) {
				console.error(err.message);
				res.status(500).send({ error: "Payment intent creation failed" });
			}
		});

		app.patch("/users/membership/:email", verifyToken, async (req, res) => {
			const email = req.params.email;

			const result = await usersCollection.updateOne({ email }, { $set: { isMember: true, badge: "gold" } });

			res.send(result);
		});

		app.post("/payments", verifyToken, async (req, res) => {
			try {
				const payment = req.body;

				if (!payment?.email || !payment?.amount || !payment?.transactionId || !payment?.paymentMethod) {
					return res.status(400).send({ message: "Missing required fields" });
				}

				const now = new Date();
				payment.paid_at = now;
				payment.paid_at_string = now.toISOString();

				const result = await paymentsCollection.insertOne(payment);

				res.send(result);
			} catch (error) {
				console.error("Payment insert error:", error.message);
				res.status(500).send({ message: "Server error inserting payment" });
			}
		});

		app.get("/users/posts-info", verifyToken, async (req, res) => {
			try {
				const email = req.query.email;

				if (!email) {
					return res.status(400).send({ message: "Missing email" });
				}

				const count = await postsCollection.countDocuments({ authorEmail: email });
				const user = await usersCollection.findOne({ email });

				const isGoldMember = user?.badge === "gold";

				res.send({
					count,
					isMember: isGoldMember,
				});
			} catch (err) {
				console.error("Error in GET /users/posts-info:", err.message);
				res.status(500).send({ message: "Failed to get post info" });
			}
		});

		app.post("/posts", verifyToken, async (req, res) => {
			try {
				const post = req.body;

				if (!post?.title || !post?.description || !post?.tags || !Array.isArray(post.tags)) {
					return res.status(400).send({ message: "Missing or invalid fields" });
				}

				post.voters = [];
				post.upvote = 0;
				post.downvote = 0;
				post.visible = true;
				post.created_at = new Date().toISOString();

				post.tags = post.tags.map((t) => t.trim().toLowerCase());

				const result = await postsCollection.insertOne(post);
				res.send(result);
			} catch (err) {
				console.error("Error in POST /posts:", err.message);
				res.status(500).send({ message: "Failed to add post" });
			}
		});

		app.get("/tags", verifyToken, async (req, res) => {
			try {
				const result = await tagsCollection.find().toArray();
				res.send(result);
			} catch (error) {
				console.error("Failed to fetch tags:", error);
				res.status(500).send({ message: "Internal server error" });
			}
		});

		app.get("/user-posts", verifyToken, async (req, res) => {
			try {
				const authorEmail = req.query.authorEmail;
				const page = parseInt(req.query.page) || 0;
				const limit = parseInt(req.query.limit) || 10;

				if (!authorEmail) {
					return res.status(400).send({ message: "Missing authorEmail" });
				}

				const query = { authorEmail };

				const total = await postsCollection.countDocuments(query);

				const posts = await postsCollection
					.aggregate([
						{ $match: query },
						{ $sort: { created_at: -1 } },
						{ $skip: page * limit },
						{ $limit: limit },
						{
							$addFields: {
								postIdStr: { $toString: "$_id" },
							},
						},
						{
							$lookup: {
								from: "comments",
								localField: "postIdStr",
								foreignField: "postId",
								as: "comments",
							},
						},
						{
							$addFields: {
								commentCount: { $size: "$comments" },
							},
						},
						{
							$project: {
								comments: 0,
								postIdStr: 0,
							},
						},
					])
					.toArray();

				res.send({ total, posts });
			} catch (err) {
				console.error("Error fetching user posts:", err.message);
				res.status(500).send({ message: "Failed to fetch posts" });
			}
		});

		app.delete("/posts/:id", verifyToken, async (req, res) => {
			try {
				const id = req.params.id;

				const post = await postsCollection.findOne({ _id: new ObjectId(id) });

				if (!post) {
					return res.status(404).send({ message: "Post not found" });
				}

				if (post.authorEmail !== req.user.email) {
					return res.status(403).send({ message: "Unauthorized to delete this post" });
				}

				const result = await postsCollection.deleteOne({ _id: new ObjectId(id) });

				if (result.deletedCount > 0) {
					res.send({ message: "Post deleted successfully" });
				} else {
					res.status(500).send({ message: "Failed to delete post" });
				}
			} catch (error) {
				console.error("Error deleting post:", error);
				res.status(500).send({ message: "Internal server error" });
			}
		});

		app.patch("/report-comment/:id", verifyToken, async (req, res) => {
			const id = req.params.id;
			const { feedback } = req.body;
			const result = await commentsCollection.updateOne(
				{ _id: new ObjectId(id) },
				{ $set: { feedback, reported: true } }
			);
			res.send(result);
		});

		app.get("/secure-comments/:postId", verifyToken, async (req, res) => {
			try {
				const postId = req.params.postId;

				if (!postId) {
					return res.status(400).send({ message: "Missing postId" });
				}

				const comments = await commentsCollection.find({ postId }).sort({ created_at: -1 }).toArray();

				res.send(comments);
			} catch (error) {
				console.error("❌ Failed to fetch secure comments:", error.message);
				res.status(500).send({ message: "Failed to fetch comments" });
			}
		});

		app.get("/posts", async (req, res) => {
			try {
				const { page = 0, limit = 5, sort = "newest", search } = req.query;

				let query = {};

				if (search) {
					query.tags = {
						$elemMatch: {
							$regex: search.toLowerCase(),
							$options: "i",
						},
					};
				}

				let sortOption = { created_at: -1 };
				if (sort === "popular") {
					sortOption = { voteDifference: -1 };
				}

				const skip = parseInt(page) * parseInt(limit);

				const aggregationPipeline = [
					{ $match: query },
					{
						$addFields: {
							voteDifference: { $subtract: ["$upvote", "$downvote"] },
						},
					},
					{ $sort: sortOption },
					{ $skip: skip },
					{ $limit: parseInt(limit) },
					{
						$lookup: {
							from: "comments",
							localField: "title",
							foreignField: "postTitle",
							as: "comments",
						},
					},
					{
						$addFields: {
							commentCount: { $size: "$comments" },
						},
					},
					{
						$project: {
							comments: 0,
						},
					},
				];

				const posts = await postsCollection.aggregate(aggregationPipeline).toArray();

				const totalCountPipeline = [{ $match: query }, { $count: "count" }];
				const totalResult = await postsCollection.aggregate(totalCountPipeline).toArray();
				const total = totalResult[0]?.count || 0;

				res.send({ posts, total });
			} catch (err) {
				console.error("Error in GET /posts:", err.message);
				res.status(500).send({ message: "Failed to fetch posts" });
			}
		});

		app.get("/tags-with-counts", async (req, res) => {
			try {
				const tags = await tagsCollection.find().toArray();

				const tagCounts = await postsCollection
					.aggregate([{ $unwind: "$tags" }, { $group: { _id: "$tags", count: { $sum: 1 } } }])
					.toArray();

				const enrichedTags = tags
					.map((tag) => {
						const match = tagCounts.find((t) => t._id === tag.name);
						if (match) {
							return {
								...tag,
								count: match.count,
							};
						}
						return null;
					})
					.filter(Boolean);

				res.send(enrichedTags);
			} catch (err) {
				console.error("Error in /tags-with-counts:", err.message);
				res.status(500).send({ message: "Failed to load tags with post counts" });
			}
		});

		app.get("/public-announcements", async (req, res) => {
			try {
				const announcements = await announcementsCollection.find().sort({ created_at: -1 }).toArray();
				res.send(announcements);
			} catch (err) {
				console.error("Error in GET /public-announcements:", err.message);
				res.status(500).send({ message: "Failed to fetch announcements" });
			}
		});

		app.get("/posts/:id", async (req, res) => {
			try {
				const { id } = req.params;

				const post = await postsCollection
					.aggregate([
						{ $match: { _id: new ObjectId(id) } },
						{
							$lookup: {
								from: "comments",
								localField: "title",
								foreignField: "postTitle",
								as: "comments",
							},
						},
						{
							$addFields: {
								commentCount: { $size: "$comments" },
							},
						},
						{
							$project: {
								comments: 0,
							},
						},
					])
					.toArray();

				if (!post || post.length === 0) {
					return res.status(404).send({ message: "Post not found" });
				}

				res.send(post[0]);
			} catch (err) {
				console.error("Error in GET /posts/:id:", err.message);
				res.status(500).send({ message: "Failed to fetch post" });
			}
		});

		app.patch("/posts/:id/vote", verifyToken, async (req, res) => {
			try {
				const postId = req.params.id;
				const { email } = req.user;
				const { type } = req.body;

				if (!["upvote", "downvote"].includes(type)) {
					return res.status(400).send({ message: "Invalid vote type" });
				}

				const post = await postsCollection.findOne({ _id: new ObjectId(postId) });
				if (!post) return res.status(404).send({ message: "Post not found" });

				const alreadyVoted = post.voters?.find((v) => v.email === email);

				let update = {};
				if (!alreadyVoted) {
					update = {
						$inc: { [type]: 1 },
						$push: { voters: { email, type } },
					};
				} else if (alreadyVoted.type === type) {
					update = {
						$inc: { [type]: -1 },
						$pull: { voters: { email } },
					};
				} else {
					update = {
						$inc: {
							[alreadyVoted.type]: -1,
							[type]: 1,
						},
						$pull: { voters: { email } },
					};
					await postsCollection.updateOne({ _id: new ObjectId(postId) }, update);
					update = {
						$push: { voters: { email, type } },
					};
				}

				const result = await postsCollection.updateOne({ _id: new ObjectId(postId) }, update);

				res.send(result);
			} catch (err) {
				console.error("Vote Error:", err.message);
				res.status(500).send({ message: "Failed to vote" });
			}
		});

		app.post("/searches", async (req, res) => {
			const { text } = req.body;
			if (!text) return res.status(400).send({ message: "Missing search text" });

			try {
				const result = await searchesCollection.updateOne(
					{ text },
					{
						$setOnInsert: { created_at: new Date() },
						$inc: { votes: 1 },
					},
					{ upsert: true }
				);
				res.send(result);
			} catch (err) {
				console.error("Search insert error:", err);
				res.status(500).send({ message: "Failed to record search" });
			}
		});

		app.get("/popular-searches", async (req, res) => {
			try {
				const searches = await searchesCollection.find().sort({ votes: -1, created_at: -1 }).limit(3).toArray();
				res.send(searches);
			} catch (err) {
				console.error("Search fetch error:", err);
				res.status(500).send({ message: "Failed to fetch searches" });
			}
		});

		app.post("/comments", async (req, res) => {
			try {
				const comment = req.body;

				if (!comment || !comment.postId || !comment.postTitle || !comment.text || !comment.userEmail) {
					return res.status(400).send({ message: "Invalid comment data" });
				}

				comment.created_at = new Date();
				const result = await commentsCollection.insertOne(comment);
				res.send(result);
			} catch (error) {
				console.error("❌ Failed to insert comment:", error.message);
				res.status(500).send({ message: "Failed to create comment" });
			}
		});

		app.get("/comments", async (req, res) => {
			try {
				const { postId } = req.query;

				if (!postId) {
					return res.status(400).send({ message: "Missing postId" });
				}

				const comments = await commentsCollection.find({ postId }).sort({ created_at: -1 }).toArray();

				res.send(comments);
			} catch (error) {
				console.error("❌ Failed to fetch comments:", error.message);
				res.status(500).send({ message: "Failed to fetch comments" });
			}
		});

		app.post("/jwt", async (req, res) => {
			try {
				const { email } = req.body;

				if (!email || typeof email !== "string") {
					return res.status(400).send({ success: false, message: "Valid email is required" });
				}

				const token = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET, {
					expiresIn: "365d",
				});

				res
					.cookie("token", token, {
						httpOnly: true,
						secure: process.env.NODE_ENV === "production",
						sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
					})
					.send({ success: true });
			} catch (error) {
				console.error("Error in /jwt:", error.message);
				res.status(500).send({ success: false, message: "JWT creation failed" });
			}
		});

		app.get("/logout", async (req, res) => {
			try {
				res
					.clearCookie("token", {
						maxAge: 0,
						secure: process.env.NODE_ENV === "production",
						sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
					})
					.send({ success: true });
			} catch (err) {
				res.status(500).send(err);
			}
		});
	} finally {
	}
}
run().catch(console.dir);
