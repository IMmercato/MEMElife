const api_key = "716527226913465";
const cloud_name = "dpx78k27a";

import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.1.2/firebase-app.js';
import { getFirestore, setDoc, deleteDoc, collection, doc, getDocs, query, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.1.2/firebase-firestore.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.1.2/firebase-auth.js';

// Initialize Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBHVk5ijv2KLWuKzBGoRR76qolOhL3qb-k",
    authDomain: "meme-bb867.firebaseapp.com",
    projectId: "meme-bb867",
    storageBucket: "meme-bb867.firebasestorage.app",
    messagingSenderId: "528411031923",
    appId: "1:528411031923:web:f7e52f4eaf94a3b2fe2d06",
};
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

document.addEventListener("DOMContentLoaded", function () {
  const authButton = document.getElementById("auth-button");
  const uploadForm = document.querySelector("#upload-form");

  if (authButton && document.getElementById("auth-message") && uploadForm) {
    handleAuth();
    handleUpload();
  } else {
    handleImageCollection();
  }
});

function handleAuth() {
  onAuthStateChanged(auth, (user) => {
    const authButton = document.getElementById("auth-button");
    const authMessage = document.getElementById("auth-message");
    if (user) {
      console.log("User is logged in: ", user.uid);
      authButton.disabled = true;
      authMessage.innerText = "User is logged in.";
      authMessage.style.color = "green";
    } else {
      console.log("User is not logged in.");
      authButton.disabled = false;
      authMessage.innerText = "User is not logged in.";
      authMessage.style.color = "red";
    }
  });

  document.querySelector("#auth-button").addEventListener("click", function () {
    signInAnonymously(auth)
      .then((userCredential) => {
        const user = userCredential.user;
        console.log("User ID:", user.uid);
        setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          createdAt: serverTimestamp(),
        })
          .then(() => {
            console.log("User ID saved in Firestore");
            document.getElementById("auth-message").innerText = "Authenticated successfully!";
          })
          .catch((error) => {
            console.error("Error saving user ID:", error);
            document.getElementById("auth-message").innerText = "Error saving user ID.";
          });
      })
      .catch((error) => {
        console.error("Error signing in anonymously:", error);
        document.getElementById("auth-message").innerText = "Authentication failed. Try again.";
      });
  });
}

function handleUpload() {
  document.querySelector("#upload-form").addEventListener("submit", async function (e) {
    e.preventDefault()
    const signatureResponse = await axios.get("/get-signature")
    const data = new FormData()
    data.append("file", document.querySelector("#file-field").files[0])
    data.append("api_key", api_key)
    data.append("signature", signatureResponse.data.signature)
    data.append("timestamp", signatureResponse.data.timestamp)
    const cloudinaryResponse = await axios.post(`https://api.cloudinary.com/v1_1/${cloud_name}/auto/upload`, data, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: function (e) {
        console.log(e.loaded / e.total)
      }
    })
    console.log(cloudinaryResponse.data)
    const photoData = {
      public_id: cloudinaryResponse.data.public_id,
      version: cloudinaryResponse.data.version,
      signature: cloudinaryResponse.data.signature
    }
    axios.post("/do-something-with-photo", photoData)
    onAuthStateChanged(auth, (user) => {
      if (user) {
        setDoc(doc(db, `users/${user.uid}/images`, cloudinaryResponse.data.public_id), {
          public_id: cloudinaryResponse.data.public_id,
          version: cloudinaryResponse.data.version,
          createdAt: serverTimestamp(),
        })
          .then(() => {
            console.log("Image data saved in Firestore");
          })
          .catch((error) => {
            console.error("Error saving image data in Firestore:", error);
          });
      } else {
        console.error("User is not authenticated");
      }
    });
  });
}

async function checkImageExists(publicId) {
  try {
    const response = await axios.head(`https://res.cloudinary.com/${cloud_name}/image/upload/${publicId}.jpg`);
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

function handleImageCollection() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const imagesCollectionRef = collection(db, `users/${user.uid}/images`);
        const q = query(imagesCollectionRef);
        const querySnapshot = await getDocs(q);

        let publicIds = [];
        for (let docSnapshot of querySnapshot.docs) {
          const data = docSnapshot.data();
          if (data.public_id) {
            const exists = await checkImageExists(data.public_id);
            if (exists) {
              publicIds.push(data.public_id);
            } else {
              await deleteDoc(doc(db, `users/${user.uid}/images`, data.public_id));
              console.log(`Deleted non-existing image with public_id: ${data.public_id}`);
            }
          }
        }
        console.log("Public IDs:", publicIds);
        setTimeout(() => {
          window.location.reload();
        }, 10000);
        axios.post("/view-photos", { public_ids: publicIds })
          .then(response => {
            console.log("Server response:", response.data);
          })
          .catch((error) => {
            console.error("Error sending public IDs:", error);
          });
      } catch (error) {
        console.error("Error getting image data from Firestore:", error);
      }
    } else {
      console.error("User is not authenticated");
    }
  });
}