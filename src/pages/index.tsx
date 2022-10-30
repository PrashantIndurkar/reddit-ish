import { useEffect, useState } from "react";
import { Stack } from "@chakra-ui/react";
import {
  collection,
  DocumentData,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  QuerySnapshot,
  where,
} from "firebase/firestore";
import type { NextPage } from "next";
import { useRouter } from "next/router";
import { useAuthState } from "react-firebase-hooks/auth";
import { useRecoilValue } from "recoil";
import { communityState } from "../atoms/CommunitiesAtom";
import { Post, PostVote } from "../atoms/PostAtom";
import CreatePostLink from "../components/Community/CreatePostLink";
import Recommendations from "../components/Community/Recommendations";
import PageContent from "../components/layout/PageContent";
import PostLoader from "../components/Posts/PostLoader";
import PostItem from "../components/Posts/PostItem";
import { auth, firestore } from "../firebase/clientApp";
import usePosts from "../hooks/usePosts";
import Premium from "../components/Community/Premium";
import PersonalHome from "../components/Community/PersonalHome";
import useCommunityData from "../hooks/useCommunityData";

// TODO Home Component =================
const Home: NextPage = () => {
  // useState Hook -----------------------------
  const [loading, setLoading] = useState(false);
  // useRecoilValue Hook -----------------------------
  const [user, loadingUser] = useAuthState(auth);

  const {
    postStateValue,
    setPostStateValue,
    onVote,
    onSelectPost,
    onDeletePost,
    // loading,
    // setLoading,
  } = usePosts();
  const { communityStateValue } = useCommunityData();

  // Function To get User posts-------
  const buildUserHomeFeed = async () => {
    setLoading(true);
    try {
      const feedPosts: Post[] = [];

      // User has joined communities
      if (communityStateValue.mySnippets.length) {
        const myCommunityIds = communityStateValue.mySnippets.map(
          (snippet) => snippet.communityId
        );

        let postPromises: Array<Promise<QuerySnapshot<DocumentData>>> = [];
        [0, 1, 2].forEach((index) => {
          if (!myCommunityIds[index]) return;

          postPromises.push(
            getDocs(
              query(
                collection(firestore, "posts"),
                where("communityId", "==", myCommunityIds[index]),
                limit(10)
              )
            )
          );
        });
        const queryResults = await Promise.all(postPromises);

        queryResults.forEach((result) => {
          const posts = result.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Post[];
          feedPosts.push(...posts);
        });
      }
      // User has not joined any communities yet
      else {
        console.log("USER HAS NO COMMUNITIES - GETTING GENERAL POSTS");

        const postQuery = query(
          collection(firestore, "posts"),
          orderBy("voteStatus", "desc"),
          limit(10)
        );
        const postDocs = await getDocs(postQuery);
        const posts = postDocs.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Post[];
        feedPosts.push(...posts);
      }

      console.log("HERE ARE FEED POSTS", feedPosts);

      setPostStateValue((prev) => ({
        ...prev,
        posts: feedPosts,
      }));
    } catch (error: any) {
      console.log("buildUserHomeFeed error", error.message);
    }
    setLoading(false);
  };

  // Function to get NOT users posts -----
  const buildNoUserHomeFeed = async () => {
    setLoading(true);
    try {
      const postQuery = query(
        collection(firestore, "posts"),
        orderBy("voteStatus", "desc"),
        limit(10)
      );
      const postDocs = await getDocs(postQuery);
      const posts = postDocs.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setPostStateValue((prev) => ({
        ...prev,
        posts: posts as Post[],
      }));
    } catch (error: any) {
      console.log("buildNoUserHomeFeed error", error.message);
    }
    setLoading(false);
  };

  //* Function to get user post votes -----
  const getUserPostVotes = async () => {
    const postIds = postStateValue.posts.map((post) => post.id);
    const postVotesQuery = query(
      collection(firestore, `users/${user?.uid}/postVotes`),
      where("postId", "in", postIds)
    );
    const unsubscribe = onSnapshot(postVotesQuery, (querySnapshot) => {
      const postVotes = querySnapshot.docs.map((postVote) => ({
        id: postVote.id,
        ...postVote.data(),
      }));

      setPostStateValue((prev) => ({
        ...prev,
        postVotes: postVotes as PostVote[],
      }));
    });

    return () => unsubscribe();
  };
  //* useEffect to get user home feed -----
  useEffect(() => {
    if (communityStateValue.snippetsFetched) buildUserHomeFeed();
  }, [communityStateValue.snippetsFetched]);

  //* no user home feed useEffect
  useEffect(() => {
    if (!user && !loadingUser) {
      buildNoUserHomeFeed();
    }
  }, [user, loadingUser]);

  // useEffect to get user post votes
  useEffect(() => {
    if (!user?.uid || !postStateValue.posts.length) return;
    getUserPostVotes();

    // Clear postVotes on dismount clean up FUNCTION
    return () => {
      setPostStateValue((prev) => ({
        ...prev,
        postVotes: [],
      }));
    };
  }, [postStateValue.posts, user?.uid]);

  // TODO Return =================
  return (
    <PageContent>
      <>
        <CreatePostLink />
        {loading ? (
          <PostLoader />
        ) : (
          <Stack>
            {postStateValue.posts.map((post: Post, index) => (
              <PostItem
                key={post.id}
                post={post}
                // postIdx={index}
                onVote={onVote}
                onDeletePost={onDeletePost}
                userVoteValue={
                  postStateValue.postVotes.find(
                    (item) => item.postId === post.id
                  )?.voteValue
                }
                userIsCreator={user?.uid === post.creatorId}
                onSelectPost={onSelectPost}
                homePage
              />
            ))}
          </Stack>
        )}
      </>
      <Stack spacing={5} position="sticky" top="14px">
        <Recommendations />
        <Premium />
        <PersonalHome />
      </Stack>
    </PageContent>
  );
};

export default Home;
