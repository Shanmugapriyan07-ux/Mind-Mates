import {
  Client,
  Account,
  ID,
  OAuthProvider,
  Avatars,
 
} from "react-native-appwrite";
import * as Linking from "expo-linking";
import { openAuthSessionAsync } from "expo-web-browser";
import useAppwrite from "./useAppwrite";
import * as WebBrowser from 'expo-web-browser';
import { router } from "expo-router";
import { useEffect } from "react";
import Welcome from "@/(auth)/Welcome";

export const config = {
  platform: "com.jsm.MindMates",
  endpoint: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT,
  projectId: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID,
  databaseId: process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID,

};

export const client = new Client();
client
  .setEndpoint('https://fra.cloud.appwrite.io/v1')
  .setProject('6986e6f5001b58152799')
  .setPlatform('com.jsm.MindMates');


export const avatar = new Avatars(client);
export const account = new Account(client);


export const login = async () => {
  try {
    const redirectUrl = Linking.createURL('auth');
    
    // Advanced: Use createOAuth2Token for direct mobile handoff
    const oauthUrl = await account.createOAuth2Token(
      OAuthProvider.Google, 
      redirectUrl, 
      redirectUrl
    );
if (!oauthUrl) throw new Error("Failed to create OAuth2 token");
    const result = await WebBrowser.openAuthSessionAsync(oauthUrl.toString(), redirectUrl);

    if (result.type === 'success' && typeof result.url === 'string') {
      const url = new URL(result.url as string);
      const secret = url.searchParams.get('secret');
      const userId = url.searchParams.get('userId');

      if (secret && userId) {
        // This is the only network call we actually need here
        return await account.createSession(userId, secret);
      }
    }
    return null;
  } catch (error) {
    throw error;
  }
}


export async function logout() {
  try {
    
    const result = await account.deleteSession("current");
     router.replace('/Screens/Welcome');
    return result;
   
  } catch (error) {
    console.error(error);
    return false;
  }
}

export async function getCurrentUser() {
  try {
    const result = await account.get();
    if (result.$id) {
      const userAvatar = avatar.getInitials(result.name);

      return {
        ...result,
        avatar: userAvatar.toString(),
      };
    }

    return null;
  } catch (error) {
    console.log(error);
    return null;
  }
}
// In your lib/appwrite.ts file

export const getUser = async () => {
  try {
    const currentAccount = await account.get();
    return currentAccount;
  } catch (error) {
    // 401 means no session is active. This is normal for logged-out users.
    // We return null so the app knows to show the Login screen.
    return null;
  }
};

export const signup = async ({ email, password, name }: { email: string; password: string; name: string }) => {
  try {
    const result = await account.create(ID.unique(), email, password, name);
    return result;
  } catch (error) {
    console.error(error);
    return null;
  }
};

export default Client;


// export async function getLatestProperties() {
//   try {
//     const result = await databases.listDocuments(
//       config.databaseId!,
//       config.propertiesCollectionId!,
//       [Query.orderAsc("$createdAt"), Query.limit(5)]
//     );

//     return result.documents;
//   } catch (error) {
//     console.error(error);
//     return [];
//   }
// }

// export async function getProperties({
//   filter,
//   query,
//   limit,
// }: {
//   filter: string;
//   query: string;
//   limit?: number;
// }) {
//   try {
//     const buildQuery = [Query.orderDesc("$createdAt")];

//     if (filter && filter !== "All")
//       buildQuery.push(Query.equal("type", filter));

//     if (query)
//       buildQuery.push(
//         Query.or([
//           Query.search("name", query),
//           Query.search("address", query),
//           Query.search("type", query),
//         ])
//       );

//     if (limit) buildQuery.push(Query.limit(limit));

//     const result = await databases.listDocuments(
//       config.databaseId!,
//       config.propertiesCollectionId!,
//       buildQuery
//     );

//     return result.documents;
//   } catch (error) {
//     console.error(error);
//     return [];
//   }
// }

// // write function to get property by id
// export async function getPropertyById({ id }: { id: string }) {
//   try {
//     const result = await databases.getDocument(
//       config.databaseId!,
//       config.propertiesCollectionId!,
//       id
//     );
//     return result;
//   } catch (error) {
//     console.error(error);
//     return null;
//   }
//