'use client';

import { FeedPost, FeedAuthor, ReactionType } from './feedTypes';

const STORAGE_KEY = 'km_social_feed_v2';

export const INITIAL_SEED_POSTS: FeedPost[] = [
  {
    id: 'km-post-1',
    author: {
      id: 'recruiter-rahul',
      name: 'Rahul Sharma',
      headline: 'Senior Talent Acquisition Lead at Delhi Cargo Express',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
      isVerified: true,
      role: 'recruiter',
      badge: 'Hiring Lead',
    },
    createdAt: '2 hours ago',
    timestampMs: Date.now() - 2 * 60 * 60 * 1000,
    content: `🚨 URGENT HIRING: 25 Warehouse Logistics Coordinators & Fleet Supervisors in Delhi-NCR (Mayapuri & Okhla Phase 3).

💼 Package: ₹28,000 - ₹36,000/month + PF + ESIC + Performance Bonus
⏱ Shift: Day & Night available (8-hour rotational)
📋 Requirements: Minimum 1 year dark-store / logistics experience. Verified driving license preferred.

Direct zero-brokerage hiring on KaamMilega™. Interested candidates can drop their profile below or 1-click apply on our jobs tab! #Hiring #LogisticsJobs #KaamMilega #DelhiJobs #WarehouseCareer`,
    tags: ['#Hiring', '#LogisticsJobs', '#KaamMilega', '#DelhiJobs', '#WarehouseCareer'],
    category: 'jobs',
    mediaUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1000&auto=format&fit=crop&q=80',
    mediaType: 'image',
    likesCount: 64,
    repostsCount: 18,
    isLiked: false,
    isReposted: false,
    isSaved: false,
    comments: [
      {
        id: 'c1',
        author: {
          id: 'cand-amit',
          name: 'Amit Verma',
          headline: 'Logistics Supervisor (4 Yrs Exp) • New Delhi',
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
        },
        createdAt: '1 hour ago',
        content: 'Interested Sir! Just submitted my verified profile on KaamMilega. Have 3 years FMCG warehouse experience.',
        likesCount: 5,
        isLiked: true,
      },
      {
        id: 'c2',
        author: {
          id: 'cand-sunil',
          name: 'Sunil Kumar',
          headline: 'Fleet Dispatcher • Okhla',
        },
        createdAt: '45 mins ago',
        content: 'Are interview slots available tomorrow morning at the Okhla hub?',
        likesCount: 2,
        isLiked: false,
      },
    ],
  },
  {
    id: 'km-post-2',
    author: {
      id: 'candidate-priya',
      name: 'Priya Mukherjee',
      headline: 'Certified Solar PV & Electrical Technician • Pune, Maharashtra',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop&q=80',
      isVerified: true,
      role: 'candidate',
      badge: 'Certified Pro',
    },
    createdAt: '5 hours ago',
    timestampMs: Date.now() - 5 * 60 * 60 * 1000,
    content: `Proud milestone unlocked today! 🌟

After completing my 6-week Solar Energy Installation Certification through the KaamMilega skills marketplace and attending live mentor sessions with Vikram Joshi Sir, I have officially joined Tata Power Renewables as an On-Site Installation Lead!

Zero agent fees, direct verification, and transparent interview scheduling made all the difference. Never stop upskilling! 🙏⚡ #CareerMilestone #SkillsMatter #WomenInTechnicalJobs #RenewableEnergy #KaamMilegaSuccess`,
    tags: ['#CareerMilestone', '#SkillsMatter', '#WomenInTechnicalJobs', '#RenewableEnergy', '#KaamMilegaSuccess'],
    category: 'skills',
    mediaUrl: 'https://images.unsplash.com/photo-1509391365360-2e959784a276?w=1000&auto=format&fit=crop&q=80',
    mediaType: 'image',
    likesCount: 142,
    repostsCount: 37,
    isLiked: true,
    userReaction: 'celebrate',
    isReposted: false,
    isSaved: true,
    comments: [
      {
        id: 'c3',
        author: {
          id: 'mentor-vikram',
          name: 'Vikram Joshi',
          headline: 'Senior Solar Infrastructure Consultant • Top Mentor',
          avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80',
        },
        createdAt: '3 hours ago',
        content: 'Huge congratulations Priya! You showed exceptional dedication during the practical field audits. Wishing you immense success in green energy!',
        likesCount: 19,
        isLiked: true,
      },
    ],
  },
  {
    id: 'km-post-3',
    author: {
      id: 'expert-arun',
      name: 'Dr. Arun Singhania',
      headline: 'Vocational Training & Skill Development Advisor • Ex-NSDC',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&auto=format&fit=crop&q=80',
      isVerified: true,
      role: 'expert',
      badge: 'Industry Mentor',
    },
    createdAt: '1 day ago',
    timestampMs: Date.now() - 24 * 60 * 60 * 1000,
    content: `💡 3 Quick Tips for blue-collar and technical candidates to double their recruiter interview calls in India:

1️⃣ Add your Aadhaar & Skill Certificate directly to your KaamMilega profile. Verified profiles get 4.2x higher response rates.
2️⃣ Clearly specify your preferred city and whether you are available for Immediate Joining. Recruiters filter for "Join within 48 hours" first.
3️⃣ If you do spot work via InstantMilega™, keep your GPS availability and rating updated. Top-rated gig workers receive direct permanent job offers from employers who test their work on-site!

Drop your question in the comments if you need resume or interview advice. #CareerTips #VocationalTraining #InterviewPrep #BharatWorkforce`,
    tags: ['#CareerTips', '#VocationalTraining', '#InterviewPrep', '#BharatWorkforce'],
    category: 'mentors',
    likesCount: 98,
    repostsCount: 29,
    isLiked: false,
    isReposted: false,
    isSaved: false,
    comments: [
      {
        id: 'c4',
        author: {
          id: 'cand-raju',
          name: 'Raju Paswan',
          headline: 'CNC Machine Operator • Noida',
        },
        createdAt: '18 hours ago',
        content: 'Thank you Sir! Tip #2 helped me get 2 recruiter calls this morning itself.',
        likesCount: 6,
        isLiked: false,
      },
    ],
  },
  {
    id: 'km-post-4',
    author: {
      id: 'worker-deepak',
      name: 'Deepak Chouhan',
      headline: 'On-Demand Electrical & Maintenance Specialist • Mumbai Suburban',
      avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&auto=format&fit=crop&q=80',
      isVerified: true,
      role: 'candidate',
      badge: 'Top Rated Pro',
    },
    createdAt: '1 day ago',
    timestampMs: Date.now() - 30 * 60 * 60 * 1000,
    content: `Completed 3 on-demand spot assignments in Thane today via InstantMilega™! ⚡️

Total earnings: ₹2,150 credited straight to my KaamMilega wallet before evening with zero deduction. For all freelance electricians and technicians looking for steady local gigs between major projects, spot hiring is a game changer. 

Stay verified and deliver honest quality work! #InstantMilega #ElectricianWork #MumbaiTechnicians #DailyEarnings #ZeroBrokerage`,
    tags: ['#InstantMilega', '#ElectricianWork', '#MumbaiTechnicians', '#DailyEarnings', '#ZeroBrokerage'],
    category: 'skills',
    mediaUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=1000&auto=format&fit=crop&q=80',
    mediaType: 'image',
    likesCount: 88,
    repostsCount: 14,
    isLiked: false,
    isReposted: false,
    isSaved: false,
    comments: [],
  },
];

export const getFeedPosts = (): FeedPost[] => {
  if (typeof window === 'undefined') return INITIAL_SEED_POSTS;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_SEED_POSTS));
      return INITIAL_SEED_POSTS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_SEED_POSTS;
  } catch (e) {
    console.error('Error reading social feed from localStorage:', e);
    return INITIAL_SEED_POSTS;
  }
};

export const saveFeedPosts = (posts: FeedPost[]): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
  } catch (e) {
    console.error('Error saving social feed to localStorage:', e);
  }
};

export const createPost = (
  newPostData: {
    author: FeedAuthor;
    content: string;
    category?: FeedPost['category'];
    mediaUrl?: string;
    tags?: string[];
  }
): FeedPost => {
  const currentPosts = getFeedPosts();
  const newPost: FeedPost = {
    id: `km-post-${Date.now()}`,
    author: newPostData.author,
    createdAt: 'Just now',
    timestampMs: Date.now(),
    content: newPostData.content,
    category: newPostData.category || 'all',
    mediaUrl: newPostData.mediaUrl,
    mediaType: newPostData.mediaUrl ? 'image' : undefined,
    tags: newPostData.tags || [],
    likesCount: 0,
    repostsCount: 0,
    isLiked: false,
    isReposted: false,
    isSaved: false,
    comments: [],
  };

  const updated = [newPost, ...currentPosts];
  saveFeedPosts(updated);
  return newPost;
};

export const toggleLikePost = (postId: string, reaction: ReactionType = 'like'): FeedPost[] => {
  const currentPosts = getFeedPosts();
  const updated = currentPosts.map((post) => {
    if (post.id !== postId) return post;
    const wasLiked = post.isLiked;
    const newIsLiked = !wasLiked;
    return {
      ...post,
      isLiked: newIsLiked,
      userReaction: newIsLiked ? reaction : undefined,
      likesCount: newIsLiked ? post.likesCount + 1 : Math.max(0, post.likesCount - 1),
    };
  });
  saveFeedPosts(updated);
  return updated;
};

export const toggleSavePost = (postId: string): FeedPost[] => {
  const currentPosts = getFeedPosts();
  const updated = currentPosts.map((post) => {
    if (post.id !== postId) return post;
    return {
      ...post,
      isSaved: !post.isSaved,
    };
  });
  saveFeedPosts(updated);
  return updated;
};

export const toggleRepostPost = (postId: string): FeedPost[] => {
  const currentPosts = getFeedPosts();
  const updated = currentPosts.map((post) => {
    if (post.id !== postId) return post;
    const wasReposted = post.isReposted;
    return {
      ...post,
      isReposted: !wasReposted,
      repostsCount: !wasReposted ? post.repostsCount + 1 : Math.max(0, post.repostsCount - 1),
    };
  });
  saveFeedPosts(updated);
  return updated;
};

export const addCommentToPost = (
  postId: string,
  commentInput: { author: FeedAuthor; content: string }
): FeedPost[] => {
  const currentPosts = getFeedPosts();
  const updated = currentPosts.map((post) => {
    if (post.id !== postId) return post;
    const newComment = {
      id: `comm-${Date.now()}`,
      author: commentInput.author,
      createdAt: 'Just now',
      content: commentInput.content,
      likesCount: 0,
      isLiked: false,
    };
    return {
      ...post,
      comments: [newComment, ...post.comments],
    };
  });
  saveFeedPosts(updated);
  return updated;
};

export const deletePost = (postId: string): FeedPost[] => {
  const currentPosts = getFeedPosts();
  const updated = currentPosts.filter((p) => p.id !== postId);
  saveFeedPosts(updated);
  return updated;
};
