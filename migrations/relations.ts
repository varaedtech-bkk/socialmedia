import { relations } from "drizzle-orm/relations";
import { users, platformRateLimits, posts, subscriptions, subscriptionTiers } from "./schema";

export const platformRateLimitsRelations = relations(platformRateLimits, ({one}) => ({
	user: one(users, {
		fields: [platformRateLimits.userId],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	platformRateLimits: many(platformRateLimits),
	posts: many(posts),
	subscriptions: many(subscriptions),
}));

export const postsRelations = relations(posts, ({one}) => ({
	user: one(users, {
		fields: [posts.userId],
		references: [users.id]
	}),
}));

export const subscriptionsRelations = relations(subscriptions, ({one}) => ({
	user: one(users, {
		fields: [subscriptions.userId],
		references: [users.id]
	}),
	subscriptionTier: one(subscriptionTiers, {
		fields: [subscriptions.tierId],
		references: [subscriptionTiers.id]
	}),
}));

export const subscriptionTiersRelations = relations(subscriptionTiers, ({many}) => ({
	subscriptions: many(subscriptions),
}));