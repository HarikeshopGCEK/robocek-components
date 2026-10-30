console.log("app.js loaded as module");

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

/* ---------- FIREBASE CONFIG ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyA2f8VCbKYhcP8gWMmwOx-FaU5BEKjV3dI",
  authDomain: "robocek-components.firebaseapp.com",
  projectId: "robocek-components",
  storageBucket: "robocek-components.appspot.com",
  messagingSenderId: "222307898764",
  appId: "1:222307898764:web:1fcf7455be52f9e201b2a9"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Debug Firebase initialization
console.log("Firebase initialized successfully");
console.log("Auth object:", auth);

/* ---------- PAGE INITIALIZATION ---------- */

// Initialize page on load
document.addEventListener('DOMContentLoaded', function() {
  // Set moderator login as default
  showModeratorLogin();
});

/* ---------- AUTH CONFIGURATION ---------- */

// Cache for moderator role check to avoid repeated Firestore calls
let userRoleCache = {};

// Function to check if user is authorized moderator (checks Firestore role)
async function isAuthorizedModerator(uid) {
  if (!uid) return false;
  
  // Check cache first
  if (userRoleCache[uid] !== undefined) {
    return userRoleCache[uid];
  }
  
  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const isMod = userData.role === "moderator" || userData.userType === "moderator";
      userRoleCache[uid] = isMod;
      return isMod;
    }
    userRoleCache[uid] = false;
    return false;
  } catch (error) {
    console.error("Error checking moderator status:", error);
    return false;
  }
}

/* ---------- AUTH ---------- */

// Moderator login (existing function)
window.login = function () {
  const email = document.getElementById("email")?.value;
  const password = document.getElementById("password")?.value;

  signInWithEmailAndPassword(auth, email, password)
    .then(() => location.href = "dashboard.html")
    .catch(err => {
      const e = document.getElementById("error");
      if (e) e.innerText = err.message;
    });
};

// New functions for the updated index page
window.showModeratorLogin = function() {
  document.getElementById("moderatorLoginCard").style.display = "block";
  document.getElementById("userLoginCard").style.display = "none";
  document.getElementById("moderatorLoginBtn").classList.remove("secondary");
  document.getElementById("moderatorLoginBtn").classList.add("primary");
  document.getElementById("userLoginBtn").classList.remove("primary");
  document.getElementById("userLoginBtn").classList.add("secondary");
};

window.showUserLogin = function() {
  document.getElementById("moderatorLoginCard").style.display = "none";
  document.getElementById("userLoginCard").style.display = "block";
  document.getElementById("userLoginBtn").classList.remove("secondary");
  document.getElementById("userLoginBtn").classList.add("primary");
  document.getElementById("moderatorLoginBtn").classList.remove("primary");
  document.getElementById("moderatorLoginBtn").classList.add("secondary");
  showLoginForm();
};

window.showLoginForm = function() {
  document.getElementById("loginForm").style.display = "block";
  document.getElementById("signupForm").style.display = "none";
};

window.showSignupForm = function() {
  document.getElementById("loginForm").style.display = "none";
  document.getElementById("signupForm").style.display = "block";
};

window.moderatorLogin = async function() {
  console.log("Moderator login function called");
  const email = document.getElementById("modEmail").value.trim();
  const password = document.getElementById("modPassword").value;
  const errorElement = document.getElementById("modError");

  // Clear previous error
  if (errorElement) errorElement.innerText = "";

  console.log("Email:", email, "Password length:", password.length);

  // Validate input
  if (!email || !password) {
    if (errorElement) errorElement.innerText = "Please enter both email and password";
    return;
  }

  if (!email.includes("@")) {
    if (errorElement) errorElement.innerText = "Please enter a valid email address";
    return;
  }

  console.log("Attempting moderator login with email:", email);

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log("Authentication successful, checking moderator role...");
    
    // Check if user document exists in Firestore
    const userDocRef = doc(db, "users", userCredential.user.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      // First time login - create Firestore document for this moderator
      console.log("Creating Firestore document for new moderator:", userCredential.user.email);
      await setDoc(userDocRef, {
        email: userCredential.user.email,
        role: "moderator",
        userType: "moderator",
        name: userCredential.user.displayName || "Moderator",
        createdAt: new Date().toISOString()
      });
      console.log("Moderator document created successfully");
    }
    
    // Check if user has moderator role in Firestore
    const isMod = await isAuthorizedModerator(userCredential.user.uid);
    
    if (!isMod) {
      console.log("User does not have moderator role:", userCredential.user.email);
      if (errorElement) errorElement.innerText = "Access denied. This account is not authorized for moderator access.";
      await signOut(auth);
      return;
    }
    
    console.log("Moderator login successful:", userCredential.user.email);
    location.href = "dashboard.html";
  } catch (err) {
    console.error("Moderator login error:", err);
    if (errorElement) {
      switch(err.code) {
        case 'auth/user-not-found':
          errorElement.innerText = "No account found with this email";
          break;
        case 'auth/wrong-password':
          errorElement.innerText = "Incorrect password";
          break;
        case 'auth/invalid-email':
          errorElement.innerText = "Invalid email address";
          break;
        case 'auth/too-many-requests':
          errorElement.innerText = "Too many failed attempts. Please try again later";
          break;
        default:
          errorElement.innerText = err.message;
      }
    }
  }
};

window.userLogin = function() {
  const email = document.getElementById("userEmail").value;
  const password = document.getElementById("userPassword").value;

  signInWithEmailAndPassword(auth, email, password)
    .then(async (userCredential) => {
      // Check if user profile exists
      const userProfile = await getDoc(doc(db, "users", userCredential.user.uid));
      if (userProfile.exists()) {
        location.href = "user-dashboard.html";
      } else {
        // Redirect to moderator dashboard if no user profile (assume moderator)
        location.href = "dashboard.html";
      }
    })
    .catch(err => {
      const e = document.getElementById("userError");
      if (e) e.innerText = err.message;
    });
};

window.userSignup = function() {
  const name = document.getElementById("signupName").value.trim();
  const email = document.getElementById("signupEmail").value;
  const phone = document.getElementById("signupPhone").value.trim();
  const password = document.getElementById("signupPassword").value;

  if (!name || !email || !phone || !password) {
    const e = document.getElementById("signupError");
    if (e) e.innerText = "Please fill in all fields";
    return;
  }

  if (password.length < 6) {
    const e = document.getElementById("signupError");
    if (e) e.innerText = "Password must be at least 6 characters";
    return;
  }

  createUserWithEmailAndPassword(auth, email, password)
    .then(async (userCredential) => {
      // Create user profile
      await setDoc(doc(db, "users", userCredential.user.uid), {
        name: name,
        email: email,
        phone: phone,
        createdAt: new Date().toISOString(),
        userType: "customer"
      });
      
      location.href = "user-dashboard.html";
    })
    .catch(err => {
      const e = document.getElementById("signupError");
      if (e) e.innerText = err.message;
    });
};

window.logout = function () {
  signOut(auth).then(() => location.href = "index.html");
};

/* ---------- HELPER FUNCTIONS ---------- */

function showMessage(elementId, message, type) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  element.innerText = message;
  element.style.color = type === "error" ? "#ff6b6b" : "#3fa66b";
  
  // Clear message after 3 seconds for success messages
  if (type === "success") {
    setTimeout(() => {
      element.innerText = "";
    }, 3000);
  }
}

/* ---------- CATEGORY DROPDOWN HANDLER ---------- */

window.handleCategoryChange = function() {
  const categorySelect = document.getElementById("categorySelect");
  const newCategoryInput = document.getElementById("newCategoryInput");
  
  if (categorySelect.value === "__NEW__") {
    newCategoryInput.style.display = "block";
    newCategoryInput.focus();
  } else {
    newCategoryInput.style.display = "none";
    newCategoryInput.value = "";
  }
};

/* ---------- ADD NEW CATEGORY TO SEARCH ---------- */

window.addNewCategory = async function () {
  const newCategoryInput = document.getElementById("newCategory");
  const categoryMsg = document.getElementById("categoryMsg");
  const categorySelect = document.getElementById("categoryFilter");
  
  if (!newCategoryInput || !categoryMsg || !categorySelect) return;
  
  const newCategory = newCategoryInput.value.trim();
  
  if (!newCategory) {
    showMessage("categoryMsg", "Please enter a category name", "error");
    return;
  }

  // Check if category already exists
  const existingOptions = Array.from(categorySelect.options);
  const categoryExists = existingOptions.some(option => 
    option.value.toLowerCase() === newCategory.toLowerCase()
  );

  if (categoryExists) {
    showMessage("categoryMsg", "Category already exists", "error");
    return;
  }

  // Add to dropdown
  const opt = document.createElement("option");
  opt.value = newCategory;
  opt.innerText = newCategory;
  categorySelect.appendChild(opt);
  
  // Also add to component form dropdown
  const componentSelect = document.getElementById("categorySelect");
  if (componentSelect) {
    const opt2 = document.createElement("option");
    opt2.value = newCategory;
    opt2.innerText = newCategory;
    // Insert before the "Add New Category" option
    componentSelect.insertBefore(opt2, componentSelect.lastElementChild);
  }
  
  // Select the new category
  categorySelect.value = newCategory;
  
  // Clear input and show success message
  newCategoryInput.value = "";
  showMessage("categoryMsg", "Category added successfully!", "success");
};

/* ---------- ADD COMPONENT ---------- */

window.addComponent = async function () {
  const name = document.getElementById("name").value.trim();
  const categorySelect = document.getElementById("categorySelect");
  const newCategoryInput = document.getElementById("newCategoryInput");
  const price = Number(document.getElementById("price").value);
  const totalQty = Number(document.getElementById("totalQty").value) || 0;
  const rentable = document.getElementById("rentable").checked;

  let category = "";
  if (categorySelect.value === "__NEW__") {
    category = newCategoryInput.value.trim();
  } else {
    category = categorySelect.value.trim();
  }

  if (!name || !category || !price || totalQty < 0) {
    showMessage("msg", "Please fill all required fields with valid values", "error");
    return;
  }

  const id = name.toLowerCase().replace(/\s+/g, "_");

  try {
    await setDoc(doc(db, "components", id), {
      name,
      category,
      sale_price: price,
      rentable
    });

    await setDoc(doc(db, "stock", id), {
      total_qty: totalQty,
      available_qty: totalQty  // Initially all items are available
    });

    showMessage("msg", "Component added successfully!", "success");
    
    // Clear form
    document.getElementById("name").value = "";
    categorySelect.value = "";
    newCategoryInput.style.display = "none";
    newCategoryInput.value = "";
    document.getElementById("price").value = "";
    document.getElementById("totalQty").value = "";
    document.getElementById("rentable").checked = false;

    await loadCategories();
    await window.loadComponents();
  } catch (error) {
    showMessage("msg", "Error adding component: " + error.message, "error");
  }
};

/* ---------- LOAD CATEGORIES ---------- */

async function loadCategories() {
  const select = document.getElementById("categoryFilter");
  const componentSelect = document.getElementById("categorySelect");
  if (!select) return;

  const snap = await getDocs(collection(db, "components"));
  const categories = new Set();

  snap.forEach(d => {
    const c = d.data();
    if (c.category) categories.add(c.category);
  });

  // Update filter dropdown
  select.innerHTML = `<option value="">-- Select Category --</option>`;

  // Update component form dropdown
  if (componentSelect) {
    componentSelect.innerHTML = `
      <option value="">-- Select Category --</option>
      <option value="__NEW__">+ Add New Category</option>
    `;
  }

  categories.forEach(cat => {
    // Add to filter dropdown
    const opt = document.createElement("option");
    opt.value = cat;
    opt.innerText = cat;
    select.appendChild(opt);

    // Add to component form dropdown
    if (componentSelect) {
      const opt2 = document.createElement("option");
      opt2.value = cat;
      opt2.innerText = cat;
      componentSelect.appendChild(opt2);
    }
  });
}

/* ---------- STORE ALL COMPONENTS IN MEMORY FOR FILTERING ---------- */
let allComponentsData = [];

/* ---------- LOAD ALL COMPONENTS ---------- */

window.loadComponents = async function () {
  console.log("loadComponents() called");

  try {
    const countEl = document.getElementById("componentCount");
    if (!countEl) {
      console.error("Component count element not found");
      return;
    }

    console.log("Fetching all components from Firebase...");
    const snap = await getDocs(collection(db, "components"));
    console.log("Total components found in Firestore:", snap.docs.length);

    allComponentsData = [];

    for (const c of snap.docs) {
      const comp = c.data();
      console.log("Processing component:", comp.name, "Category:", comp.category);
      
      const stockSnap = await getDoc(doc(db, "stock", c.id));
      const stock = stockSnap.exists()
        ? stockSnap.data()
        : { total_qty: 0, available_qty: 0 };

      allComponentsData.push({
        id: c.id,
        name: comp.name,
        category: comp.category,
        sale_price: comp.sale_price,
        total_qty: stock.total_qty,
        available_qty: stock.available_qty
      });
    }

    console.log("All components loaded into memory:", allComponentsData.length);
    
    // Trigger filter to display components
    filterComponents();
  } catch (error) {
    console.error("Error in loadComponents:", error);
    const table = document.getElementById("componentsTable");
    if (table) {
      table.innerHTML = `
        <tr>
          <td colspan="6" style="color:#ff6b6b;">
            Error loading components: ${error.message}
          </td>
        </tr>`;
    }
  }
};

/* ---------- FILTER COMPONENTS BY CATEGORY AND SEARCH ---------- */

window.filterComponents = function () {
  const table = document.getElementById("componentsTable");
  const countEl = document.getElementById("componentCount");
  const categorySelect = document.getElementById("categoryFilter");
  const searchInput = document.getElementById("searchBar");

  if (!table || !countEl || !categorySelect) {
    console.error("Required elements not found");
    return;
  }

  const selectedCategory = categorySelect.value ? categorySelect.value.toLowerCase() : "";
  const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : "";

  console.log("Filtering - Components in memory:", allComponentsData.length);
  console.log("Selected category:", selectedCategory, "Search term:", searchTerm);

  table.innerHTML = "";
  let visibleCount = 0;

  if (!allComponentsData || allComponentsData.length === 0) {
    console.warn("No components in memory - may not be loaded yet");
    table.innerHTML = `
      <tr>
        <td colspan="6" style="color:#ff6b6b;">
          No components loaded. Please refresh the page.
        </td>
      </tr>`;
    return;
  }

  allComponentsData.forEach(comp => {
    // Filter by category (if selected)
    if (selectedCategory && comp.category.toLowerCase() !== selectedCategory) {
      return;
    }

    // Filter by search term (name contains search)
    if (searchTerm && !comp.name.toLowerCase().includes(searchTerm)) {
      return;
    }

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${comp.name}</td>
      <td>${comp.category}</td>
      <td>${comp.sale_price}</td>
      <td><input type="number" id="t_${comp.id}" value="${comp.total_qty}"></td>
      <td><input type="number" id="a_${comp.id}" value="${comp.available_qty}"></td>
      <td><button onclick="updateStock('${comp.id}')">Save</button></td>
    `;

    table.appendChild(row);
    visibleCount++;
  });

  console.log("Visible components after filter:", visibleCount, "Total in memory:", allComponentsData.length);
  countEl.innerText = visibleCount;

  if (visibleCount === 0) {
    const message = allComponentsData.length === 0 ? "No components found" : 
                    searchTerm ? "No components match your search" : 
                    selectedCategory ? "No components in this category" : 
                    "No components found";
    
    table.innerHTML = `
      <tr>
        <td colspan="6" style="color:#9fbfb0;">
          ${message}
        </td>
      </tr>`;
  }
};

/* ---------- UPDATE STOCK ---------- */

window.updateStock = async function (id) {
  const total = Number(document.getElementById(`t_${id}`).value);
  const available = Number(document.getElementById(`a_${id}`).value);

  if (total < 0 || available < 0 || available > total) {
    alert("Invalid stock values");
    return;
  }

  await updateDoc(doc(db, "stock", id), {
    total_qty: total,
    available_qty: available
  });

  alert("Stock updated");
};

/* ---------- AUTH STATE ---------- */

onAuthStateChanged(auth, async (user) => {
  const isDashboard = document.getElementById("componentsTable") !== null;
  const isRentPage = document.getElementById("rentalsTableBody") !== null;
  const isUserDashboard = document.getElementById("userRequestsTableBody") !== null;

  if (!user && (isDashboard || isRentPage || isUserDashboard)) {
    location.href = "index.html";
    return;
  }

  if (user && (isDashboard || isRentPage)) {
    // Check if user is authorized moderator for admin pages
    const isMod = await isAuthorizedModerator(user.uid);
    if (!isMod) {
      console.log("Unauthorized access attempt to admin page by:", user.email);
      alert("Access denied. You are not authorized to access this page.");
      signOut(auth).then(() => location.href = "index.html");
      return;
    }

    if (isDashboard) {
      await loadCategories();
      await window.loadComponents();
    } else if (isRentPage) {
      await window.loadRentCategories();
      await window.loadActiveRentals();
      await window.loadComponentRequests();
    }
  }
  // Note: isUserDashboard is handled in user-app.js
});

/* ---------- RENT SYSTEM FUNCTIONS ---------- */

let rentCart = [];

window.loadRentComponents = async function() {
  const categorySelect = document.getElementById("rentCategoryFilter");
  const componentsList = document.getElementById("rentComponentsList");
  const componentsSection = document.getElementById("componentsSection");
  
  if (!categorySelect || !componentsList) return;
  
  const selectedCategory = categorySelect.value;
  
  if (!selectedCategory) {
    componentsSection.style.display = "none";
    return;
  }

  try {
    console.log("Loading rent components for category:", selectedCategory);
    const snap = await getDocs(collection(db, "components"));
    componentsList.innerHTML = "";
    
    let hasComponents = false;
    let debugInfo = {
      totalComponents: 0,
      matchingCategory: 0,
      rentableComponents: 0,
      availableComponents: 0
    };
    
    for (const c of snap.docs) {
      const comp = c.data();
      debugInfo.totalComponents++;
      
      console.log(`Component: ${comp.name}, Category: ${comp.category}, Rentable: ${comp.rentable}`);
      
      if (comp.category !== selectedCategory) continue;
      debugInfo.matchingCategory++;

      if (!comp.rentable) {
        console.log(`${comp.name} is not marked as rentable`);
        continue;
      }
      debugInfo.rentableComponents++;

      const stockSnap = await getDoc(doc(db, "stock", c.id));
      const stock = stockSnap.exists() ? stockSnap.data() : { total_qty: 0, available_qty: 0 };
      
      console.log(`${comp.name} stock:`, stock);
      
      if (stock.available_qty <= 0) {
        console.log(`${comp.name} has no available stock`);
        continue;
      }
      debugInfo.availableComponents++;      hasComponents = true;
      const baseRentPrice = Math.round(comp.sale_price * 0.1); // 10% of sale price per month

      const componentDiv = document.createElement("div");
      componentDiv.className = "component-item";
      componentDiv.innerHTML = `
        <div class="component-info">
          <div class="component-name">${comp.name}</div>
          <div class="component-details">
            Available: ${stock.available_qty} | Base Rent: ₹${baseRentPrice}/month/item
          </div>
        </div>
        <div class="component-actions">
          <input type="number" id="qty_${c.id}" class="quantity-input" min="1" max="${stock.available_qty}" value="1">
          <button onclick="addToCart('${c.id}')" class="secondary btn-small">Add to Cart</button>
        </div>
      `;
      
      componentsList.appendChild(componentDiv);
    }
    
    console.log("Debug info:", debugInfo);
    
    if (hasComponents) {
      componentsSection.style.display = "block";
    } else {
      componentsSection.style.display = "block"; // Show section to display debug message
      componentsList.innerHTML = `<div style="text-align: center; color: var(--muted); padding: 20px;">
        No rentable components available in this category<br>
        <small>Debug: ${debugInfo.totalComponents} total, ${debugInfo.matchingCategory} in category, ${debugInfo.rentableComponents} rentable, ${debugInfo.availableComponents} available</small>
      </div>`;
    }
  } catch (error) {
    console.error("Error loading rent components:", error);
    showMessage("rentMsg", "Error loading components: " + error.message, "error");
  }
};

window.addToCart = async function(componentId) {
  try {
    const qtyInput = document.getElementById(`qty_${componentId}`);
    const quantity = parseInt(qtyInput.value) || 1;
    
    // Get component details
    const compSnap = await getDoc(doc(db, "components", componentId));
    const stockSnap = await getDoc(doc(db, "stock", componentId));
    
    if (!compSnap.exists()) {
      showMessage("rentMsg", "Component not found", "error");
      return;
    }
    
    const comp = compSnap.data();
    const stock = stockSnap.exists() ? stockSnap.data() : { available_qty: 0 };
    
    if (quantity > stock.available_qty) {
      showMessage("rentMsg", "Not enough quantity available", "error");
      return;
    }
    
    // Check if item already in cart
    const existingIndex = rentCart.findIndex(item => item.id === componentId);
    
    if (existingIndex >= 0) {
      // Update existing item
      const newQty = rentCart[existingIndex].quantity + quantity;
      if (newQty > stock.available_qty) {
        showMessage("rentMsg", "Total quantity exceeds available stock", "error");
        return;
      }
      rentCart[existingIndex].quantity = newQty;    } else {
      // Add new item to cart
      const baseRentPrice = Math.round(comp.sale_price * 0.1); // 10% per month
      rentCart.push({
        id: componentId,
        name: comp.name,
        baseRentPrice: baseRentPrice,
        quantity: quantity,
        maxAvailable: stock.available_qty
      });
    }
    
    updateCartDisplay();
    showMessage("rentMsg", "Item added to cart!", "success");
  } catch (error) {
    console.error("Error adding to cart:", error);
    showMessage("rentMsg", "Error adding item to cart", "error");
  }
};

function updateCartDisplay() {
  const cartDiv = document.getElementById("rentCart");
  const cartSection = document.getElementById("cartSection");
  const totalCostEl = document.getElementById("totalCost");
  const processBtn = document.getElementById("processRentBtn");
  const durationSelect = document.getElementById("rentalDuration");
  
  if (rentCart.length === 0) {
    cartSection.style.display = "none";
    processBtn.style.display = "none";
    return;
  }
  
  cartSection.style.display = "block";
  processBtn.style.display = "block";
  
  // Get selected duration
  const selectedDuration = parseInt(durationSelect.value) || 1;
  
  let totalCost = 0;
  cartDiv.innerHTML = "";
  
  rentCart.forEach((item, index) => {
    const monthlyPrice = item.baseRentPrice * item.quantity;
    const totalItemPrice = monthlyPrice * selectedDuration;
    totalCost += totalItemPrice;
    
    const cartItemDiv = document.createElement("div");
    cartItemDiv.className = "cart-item";
    cartItemDiv.innerHTML = `
      <div>
        <strong>${item.name}</strong><br>
        <small>₹${item.baseRentPrice}/month × ${item.quantity} × ${selectedDuration} months = ₹${totalItemPrice}</small>
      </div>
      <button onclick="removeFromCart(${index})" class="secondary btn-small">Remove</button>
    `;
    
    cartDiv.appendChild(cartItemDiv);
  });
  
  if (selectedDuration === 0 || !selectedDuration) {
    totalCostEl.innerHTML = `<div style="color: var(--muted);">Select duration to see pricing</div>`;
    return;
  }
  
  const tax = Math.round(totalCost * 0.02); // 2% tax
  const grandTotal = totalCost + tax;
  
  // Calculate expected return date
  const returnDate = new Date();
  returnDate.setMonth(returnDate.getMonth() + selectedDuration);
  const formattedReturnDate = returnDate.toLocaleDateString('en-IN');
  
  totalCostEl.innerHTML = `
    <div style="text-align: right;">
      <div>Duration: ${selectedDuration} month${selectedDuration > 1 ? 's' : ''}</div>
      <div>Expected Return: ${formattedReturnDate}</div>
      <div style="margin-top: 8px;">Subtotal: ₹${totalCost}</div>
      <div>Tax (2%): ₹${tax}</div>
      <div style="font-size: 1.1em; margin-top: 5px; padding-top: 5px; border-top: 1px solid var(--green);">
        <strong>Total: ₹${grandTotal}</strong>
      </div>
    </div>
  `;
}

window.removeFromCart = function(index) {
  rentCart.splice(index, 1);
  updateCartDisplay();
};

window.processRent = async function() {
  const customerName = document.getElementById("customerName").value.trim();
  const customerContact = document.getElementById("customerContact").value.trim();
  const issuedBy = document.getElementById("issuedBy").value.trim();
  const position = document.getElementById("position").value.trim();
  const durationSelect = document.getElementById("rentalDuration");
  const duration = parseInt(durationSelect.value);
  
  if (!customerName || !customerContact || !issuedBy || !position) {
    showMessage("rentMsg", "Please fill all required fields", "error");
    return;
  }
  
  if (!duration || duration <= 0) {
    showMessage("rentMsg", "Please select a rental duration", "error");
    return;
  }
  
  if (rentCart.length === 0) {
    showMessage("rentMsg", "Cart is empty", "error");
    return;
  }
  
  try {
    // Generate rental ID
    const rentalId = "RENT_" + Date.now();
    
    // Calculate total cost based on duration
    const totalCost = rentCart.reduce((sum, item) => {
      return sum + (item.baseRentPrice * item.quantity * duration);
    }, 0);
    
    const tax = Math.round(totalCost * 0.02); // 2% tax
    const grandTotal = totalCost + tax;
    
    // Calculate expected return date
    const rentDate = new Date();
    const expectedReturnDate = new Date(rentDate);
    expectedReturnDate.setMonth(expectedReturnDate.getMonth() + duration);
    
    // Create rental record
    const rentalData = {
      rentalId: rentalId,
      customerName: customerName,
      customerContact: customerContact,
      issuedBy: issuedBy,
      position: position,
      items: rentCart.map(item => ({
        ...item,
        monthlyPrice: item.baseRentPrice,
        totalPrice: item.baseRentPrice * item.quantity * duration
      })),
      duration: duration,
      totalCost: totalCost,
      tax: tax,
      grandTotal: grandTotal,
      rentDate: rentDate.toISOString(),
      expectedReturnDate: expectedReturnDate.toISOString(),
      status: "active",
      actualReturnDate: null
    };
    
    await setDoc(doc(db, "rentals", rentalId), rentalData);
    
    // Update stock for each item
    for (const item of rentCart) {
      const stockSnap = await getDoc(doc(db, "stock", item.id));
      if (stockSnap.exists()) {
        const currentStock = stockSnap.data();
        await updateDoc(doc(db, "stock", item.id), {
          available_qty: currentStock.available_qty - item.quantity
        });
      }
    }
    
    // Generate and print invoice
    generateInvoice(rentalData);
    
    // Clear form and cart
    document.getElementById("customerName").value = "";
    document.getElementById("customerContact").value = "";
    document.getElementById("issuedBy").value = "";
    document.getElementById("position").value = "";
    document.getElementById("rentalDuration").value = "";
    document.getElementById("rentCategoryFilter").value = "";
    document.getElementById("componentsSection").style.display = "none";
    rentCart = [];
    updateCartDisplay();
    
    showMessage("rentMsg", `Rental processed successfully! Rental ID: ${rentalId}`, "success");
    
    // Reload rentals table if on rent page
    if (document.getElementById("rentalsTableBody")) {
      window.loadActiveRentals();
    }
    
  } catch (error) {
    console.error("Error processing rental:", error);
    showMessage("rentMsg", "Error processing rental: " + error.message, "error");
  }
};

window.loadActiveRentals = async function() {
  const tableBody = document.getElementById("rentalsTableBody");
  if (!tableBody) return;
  
  try {
    const snap = await getDocs(collection(db, "rentals"));
    tableBody.innerHTML = "";
    
    let activeRentals = [];
    snap.forEach(doc => {
      const rental = doc.data();
      if (rental.status === "active") {
        activeRentals.push(rental);
      }
    });
      if (activeRentals.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="9" style="color: #9fbfb0; text-align: center;">
            No active rentals found
          </td>
        </tr>
      `;
      return;
    }
    
    activeRentals.sort((a, b) => new Date(b.rentDate) - new Date(a.rentDate));    activeRentals.forEach(rental => {
      const rentDate = new Date(rental.rentDate).toLocaleDateString();
      const expectedReturnDate = rental.expectedReturnDate 
        ? new Date(rental.expectedReturnDate).toLocaleDateString()
        : "Not set";
      
      const itemsText = rental.items.map(item => `${item.name} (${item.quantity})`).join(", ");
      const totalCost = rental.grandTotal || rental.totalCost; // Support both old and new format
      const duration = rental.duration || "N/A"; // Support old rentals without duration
      
      // Check if rental is overdue
      const isOverdue = rental.expectedReturnDate && new Date() > new Date(rental.expectedReturnDate);
      const overdueClass = isOverdue ? 'style="color: #ff6b6b;"' : '';
      
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${rental.rentalId}</td>
        <td>${rental.customerName}</td>
        <td>${rental.customerContact}</td>
        <td class="rental-items" title="${itemsText}">${itemsText}</td>
        <td>${duration} month${duration > 1 || duration === "N/A" ? 's' : ''}</td>
        <td>₹${totalCost}</td>
        <td>${rentDate}</td>
        <td ${overdueClass}>${expectedReturnDate}${isOverdue ? ' (Overdue)' : ''}</td>
        <td>
          <button onclick="generateInvoiceFromRental('${rental.rentalId}')" class="secondary btn-small" style="margin-right: 5px;">
            Invoice
          </button>
          <button onclick="returnRental('${rental.rentalId}')" class="primary btn-small">
            Return
          </button>
        </td>
      `;
      
      tableBody.appendChild(row);
    });
    
  } catch (error) {
    console.error("Error loading rentals:", error);    tableBody.innerHTML = `
      <tr>
        <td colspan="9" style="color: #ff6b6b; text-align: center;">
          Error loading rentals
        </td>
      </tr>
    `;
  }
};

window.returnRental = async function(rentalId) {
  if (!confirm("Mark this rental as returned?")) return;
  
  try {
    // Get rental details
    const rentalSnap = await getDoc(doc(db, "rentals", rentalId));
    if (!rentalSnap.exists()) {
      alert("Rental not found");
      return;
    }
    
    const rental = rentalSnap.data();
    
    // Update stock for each item
    for (const item of rental.items) {
      const stockSnap = await getDoc(doc(db, "stock", item.id));
      if (stockSnap.exists()) {
        const currentStock = stockSnap.data();
        await updateDoc(doc(db, "stock", item.id), {
          available_qty: currentStock.available_qty + item.quantity
        });
      }
    }
      // Mark rental as returned
    await updateDoc(doc(db, "rentals", rentalId), {
      status: "returned",
      actualReturnDate: new Date().toISOString()
    });
    
    alert("Rental marked as returned successfully!");
    loadActiveRentals();
    
  } catch (error) {
    console.error("Error returning rental:", error);
    alert("Error processing return: " + error.message);
  }
};

window.filterRentals = function() {
  const searchTerm = document.getElementById("searchRental").value.toLowerCase();
  const tableBody = document.getElementById("rentalsTableBody");
  if (!tableBody) return;
  
  const rows = tableBody.getElementsByTagName("tr");
  
  for (let row of rows) {
    if (row.cells.length < 7) continue; // Skip header or empty rows
    
    const customerName = row.cells[1].textContent.toLowerCase();
    const rentalId = row.cells[0].textContent.toLowerCase();
    
    if (customerName.includes(searchTerm) || rentalId.includes(searchTerm)) {
      row.style.display = "";
    } else {
      row.style.display = "none";
    }
  }
};

// Load categories for rent page
window.loadRentCategories = async function() {
  const select = document.getElementById("rentCategoryFilter");
  if (!select) return;

  try {
    const snap = await getDocs(collection(db, "components"));
    const categories = new Set();

    snap.forEach(d => {
      const c = d.data();
      if (c.category && c.rentable) categories.add(c.category);
    });

    select.innerHTML = `<option value="">-- Select Category --</option>`;

    categories.forEach(cat => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.innerText = cat;
      select.appendChild(opt);
    });
  } catch (error) {
    console.error("Error loading rent categories:", error);
  }
};

/* ---------- INVOICE GENERATION ---------- */

function generateInvoice(rentalData) {
  const invoiceWindow = window.open('', '_blank');
  const invoiceHTML = createInvoiceHTML(rentalData);
  
  invoiceWindow.document.write(invoiceHTML);
  invoiceWindow.document.close();
  
  // Auto print after a short delay
  setTimeout(() => {
    invoiceWindow.print();
  }, 500);
}

window.generateInvoiceFromRental = async function(rentalId) {
  try {
    const rentalSnap = await getDoc(doc(db, "rentals", rentalId));
    if (!rentalSnap.exists()) {
      alert("Rental not found");
      return;
    }
    
    const rentalData = rentalSnap.data();
    generateInvoice(rentalData);
  } catch (error) {
    console.error("Error generating invoice:", error);
    alert("Error generating invoice: " + error.message);
  }
};

function createInvoiceHTML(rental) {
  const rentDate = new Date(rental.rentDate);
  const formattedDate = rentDate.toLocaleDateString('en-IN');
  const formattedTime = rentDate.toLocaleTimeString('en-IN');
  
  // Calculate totals (support both old and new rental formats)
  const subtotal = rental.totalCost || 0;
  const tax = rental.tax || Math.round(subtotal * 0.02);
  const grandTotal = rental.grandTotal || (subtotal + tax);
  const duration = rental.duration || 1;
  
  // Format expected return date
  const expectedReturnDate = rental.expectedReturnDate 
    ? new Date(rental.expectedReturnDate).toLocaleDateString('en-IN')
    : "Not specified";
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>ROBOCEK Rental Acknowledgement</title>
    <style>
        @page {
            size: A4;
            margin: 20mm;
        }
        
        body {
            font-family: Arial, sans-serif;
            font-size: 12px;
            line-height: 1.4;
            color: #333;
            margin: 0;
            padding: 0;
        }
        
        .header {
            text-align: center;
            border-bottom: 2px solid #333;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        
        .header h1 {
            margin: 0;
            font-size: 18px;
            font-weight: bold;
        }
        
        .company-info {
            margin: 10px 0;
        }
        
        .invoice-details {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
        }
        
        .customer-info, .rental-info {
            flex: 1;
        }
        
        .rental-info {
            text-align: right;
        }
        
        .rental-duration {
            background-color: #f0f8ff;
            border: 1px solid #4682b4;
            border-radius: 5px;
            padding: 10px;
            margin: 15px 0;
            text-align: center;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        
        th {
            background-color: #f0f0f0;
            border: 1px solid #333;
            padding: 8px;
            text-align: left;
            font-weight: bold;
        }
        
        td {
            border: 1px solid #333;
            padding: 8px;
        }
        
        .text-right {
            text-align: right;
        }
        
        .totals {
            margin-top: 20px;
        }
        
        .totals table {
            width: 50%;
            margin-left: auto;
        }
        
        .totals th, .totals td {
            border: none;
            border-bottom: 1px solid #333;
        }
        
        .grand-total {
            font-weight: bold;
            border-top: 2px solid #333 !important;
        }
        
        .footer {
            margin-top: 30px;
            border-top: 1px solid #333;
            padding-top: 15px;
        }
        
        .signature-section {
            display: flex;
            justify-content: space-between;
            margin-top: 40px;
        }
        
        .signature-box {
            text-align: center;
            width: 200px;
        }
        
        .signature-line {
            border-bottom: 1px solid #333;
            margin-bottom: 5px;
            height: 40px;
        }
        
        .terms {
            font-size: 10px;
            margin-top: 20px;
            background-color: #f9f9f9;
            padding: 10px;
            border: 1px solid #ddd;
        }
        
        @media print {
            .no-print {
                display: none;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>ROBOCEK GCEK Acknowledgement Form</h1>        <div class="company-info">
            <div><strong>ROBOCEK GCEK</strong></div>
            <div>Government College of Engineering Kannur</div>
            <div>Contact: robocek@gcek.ac.in</div>
        </div>
    </div>
    
    <div class="invoice-details">
        <div class="customer-info">
            <strong>Recipient: ${rental.customerName}</strong><br>
            Contact: ${rental.customerContact}
        </div>        <div class="rental-info">
            <strong>Date:</strong> ${formattedDate} ${formattedTime}<br>
            <strong>Rental ID:</strong> ${rental.rentalId}<br>
            ${rental.issuedBy ? `<strong>Issued By:</strong> ${rental.issuedBy}` : ''}<br>
            ${rental.position ? `<strong>Position:</strong> ${rental.position}` : ''}
        </div>
    </div>
    
    <div class="rental-duration">
        <strong>Rental Duration: ${duration} Month${duration > 1 ? 's' : ''}</strong><br>
        <strong>Expected Return Date: ${expectedReturnDate}</strong>
    </div>
    
    <div>
        <p><strong>Dear ${rental.customerName},</strong></p>
        <p>This letter serves as an acknowledgement of the components rented from ROBOCEK GCEK for a duration of <strong>${duration} month${duration > 1 ? 's' : ''}</strong>. The following components have been rented:</p>
    </div>
    
    <table>
        <thead>
            <tr>
                <th>Item</th>
                <th class="text-right">Qty</th>
                <th class="text-right">Monthly Rate (Rs)</th>
                <th class="text-right">Duration</th>
                <th class="text-right">Total (Rs)</th>
            </tr>
        </thead>
        <tbody>
            ${rental.items.map(item => {
              const monthlyRate = item.monthlyPrice || item.baseRentPrice || Math.round(item.rentPrice || 0);
              const totalPrice = item.totalPrice || (monthlyRate * item.quantity * duration);
              return `
                <tr>
                    <td>${item.name}</td>
                    <td class="text-right">${item.quantity}</td>
                    <td class="text-right">${monthlyRate.toFixed(2)}</td>
                    <td class="text-right">${duration} month${duration > 1 ? 's' : ''}</td>
                    <td class="text-right">${totalPrice.toFixed(2)}</td>
                </tr>
              `;
            }).join('')}
        </tbody>
    </table>
    
    <div class="totals">
        <table>
            <tr>
                <td><strong>Subtotal (Rs):</strong></td>
                <td class="text-right">${subtotal.toFixed(2)}</td>
            </tr>
            <tr>
                <td><strong>Discount (0%):</strong></td>
                <td class="text-right">0.00</td>
            </tr>
            <tr>
                <td><strong>Tax (2%):</strong></td>
                <td class="text-right">${tax.toFixed(2)}</td>
            </tr>
            <tr class="grand-total">
                <td><strong>Grand Total (Rs):</strong></td>
                <td class="text-right"><strong>${grandTotal.toFixed(2)}</strong></td>
            </tr>
        </table>
    </div>
      <div class="signature-section">
        <div class="signature-box">
            <div class="signature-line"></div>
            <strong>ROBOCEK GCEK</strong><br>
            ${rental.issuedBy || 'Authorized Representative'}<br>
            ${rental.position || 'Staff Member'}
        </div>
        <div class="signature-box">
            <div class="signature-line"></div>
            <strong>${rental.customerName}</strong><br>
            Name & Signature
        </div>
    </div>
    
    <div class="terms">
        <strong>Note:</strong> Please return rented components in original condition by <strong>${expectedReturnDate}</strong>. Any damages or loss incurred during the rental period will be your responsibility.
        <br><br>
        <strong>Terms & Conditions:</strong>
        <ul style="margin: 5px 0; padding-left: 20px;">
            <li>Components must be returned by the expected return date: <strong>${expectedReturnDate}</strong></li>
            <li>Components must be returned in working condition</li>
            <li>Rental charges are non-refundable</li>
            <li>Late return may incur additional charges</li>
            <li>Customer is responsible for any damage or loss</li>
        </ul>
    </div>
    
    <div class="no-print" style="margin-top: 20px; text-align: center;">
        <button onclick="window.print()" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">
            Print Invoice
        </button>
        <button onclick="window.close()" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer; margin-left: 10px;">
            Close
        </button>
    </div>
</body>
</html>
  `;
}

// Debug function to check specific component
window.checkComponent = async function(componentName) {
  try {
    const snap = await getDocs(collection(db, "components"));
    let found = false;
    
    snap.forEach(doc => {
      const comp = doc.data();
      if (comp.name.toLowerCase().includes(componentName.toLowerCase())) {
        found = true;
        console.log("Found component:", doc.id, comp);
        
        // Also check stock
        getDoc(doc(db, "stock", doc.id)).then(stockSnap => {
          const stock = stockSnap.exists() ? stockSnap.data() : "No stock record";
          console.log("Stock for", comp.name, ":", stock);
        });
      }
    });
    
    if (!found) {
      console.log("Component not found:", componentName);
    }
  } catch (error) {
    console.error("Error checking component:", error);
  }
};

/* ---------- COMPONENT REQUESTS MANAGEMENT ---------- */

window.loadComponentRequests = async function() {
  const tableBody = document.getElementById("requestsTableBody");
  const statusFilter = document.getElementById("statusFilter");
  if (!tableBody) return;
  
  try {
    // Load requests from both collections
    const guestRequestsSnap = await getDocs(collection(db, "component_requests"));
    const userRequestsSnap = await getDocs(collection(db, "user_requests"));
    
    tableBody.innerHTML = "";
    
    let allRequests = [];
    
    // Add guest component requests
    guestRequestsSnap.forEach(doc => {
      const request = doc.data();
      request.source = "guest";
      allRequests.push(request);
    });
    
    // Add user requests (rental, component, sell)
    userRequestsSnap.forEach(doc => {
      const request = doc.data();
      request.source = "user";
      allRequests.push(request);
    });
    
    // Filter by status if selected
    const selectedStatus = statusFilter ? statusFilter.value : "";
    if (selectedStatus) {
      allRequests = allRequests.filter(request => request.status === selectedStatus);
    }
    
    if (allRequests.length === 0) {
      const message = selectedStatus ? `No ${selectedStatus} requests found` : "No requests found";
      tableBody.innerHTML = `
        <tr>
          <td colspan="9" style="color: #9fbfb0; text-align: center;">
            ${message}
          </td>
        </tr>
      `;
      return;
    }
    
    // Sort by request date (newest first)
    allRequests.sort((a, b) => new Date(b.requestDate) - new Date(a.requestDate));
    
    allRequests.forEach(request => {
      const requestDate = new Date(request.requestDate).toLocaleDateString();
      let itemsText = "";
      let estimatedTotal = 0;
      let duration = "N/A";
      let requestType = "";
      
      // Handle different request types
      if (request.type === "rental") {
        requestType = "Rental";
        itemsText = request.items.map(item => `${item.name} (${item.quantity})`).join(", ");
        estimatedTotal = request.grandTotal || 0;
        duration = request.duration || "N/A";
      } else if (request.type === "component") {
        requestType = "New Component";
        itemsText = `${request.componentName} - ${request.description}`;
        estimatedTotal = 0;
        duration = "N/A";
      } else if (request.type === "sell") {
        requestType = "Sell to Us";
        itemsText = `${request.componentName} (${request.quantity}) - ${request.condition}`;
        estimatedTotal = request.askingPrice || 0;
        duration = "N/A";
      } else {
        // Guest component request (legacy format)
        requestType = "Component (Guest)";
        itemsText = request.items ? 
          request.items.map(item => `${item.name} (${item.quantity})`).join(", ") :
          "Component request";
        estimatedTotal = request.estimatedTotal || request.estimatedCost || 0;
        duration = request.duration || "N/A";
      }
      
      // Status styling
      let statusClass = "";
      let statusText = request.status || "pending";
      switch(statusText) {
        case "pending":
          statusClass = 'style="color: #ffa500;"';
          statusText = "Pending Review";
          break;
        case "approved":
          statusClass = 'style="color: #3fa66b;"';
          statusText = "Approved";
          break;
        case "rejected":
          statusClass = 'style="color: #ff6b6b;"';
          statusText = "Rejected";
          break;
        case "completed":
          statusClass = 'style="color: #6c757d;"';
          statusText = "Completed";
          break;
      }
      
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${request.requestId}</td>
        <td>${request.requesterName}</td>
        <td>${request.requesterContact}</td>
        <td class="rental-items" title="${itemsText}">${requestType}: ${itemsText}</td>
        <td>${duration} ${duration !== "N/A" ? (duration > 1 ? 'months' : 'month') : ''}</td>
        <td>₹${estimatedTotal}</td>
        <td ${statusClass}>${statusText}</td>
        <td>${requestDate}</td>
        <td>
          ${request.status === "pending" ? `
            <button onclick="approveRequest('${request.requestId}', '${request.source}')" class="primary btn-small" style="margin-right: 5px;">
              Approve
            </button>
            <button onclick="rejectRequest('${request.requestId}', '${request.source}')" class="secondary btn-small" style="margin-right: 5px;">
              Reject
            </button>
          ` : ''}
          ${(request.status === "approved" && request.type === "rental") ? `
            <button onclick="createRentalFromRequest('${request.requestId}', '${request.source}')" class="primary btn-small" style="margin-right: 5px;">
              Create Rental
            </button>
          ` : ''}
          <button onclick="generateRequestInvoice('${request.requestId}', '${request.source}')" class="secondary btn-small">
            Details
          </button>
        </td>
      `;
      
      tableBody.appendChild(row);
    });
    
  } catch (error) {
    console.error("Error loading requests:", error);
    tableBody.innerHTML = `
      <tr>
        <td colspan="9" style="color: #ff6b6b; text-align: center;">
          Error loading requests
        </td>
      </tr>
    `;
  }
};

window.approveRequest = async function(requestId, source = "guest") {
  try {
    const collection_name = source === "user" ? "user_requests" : "component_requests";
    
    // Get the request details before approval
    const requestSnap = await getDoc(doc(db, collection_name, requestId));
    if (!requestSnap.exists()) {
      alert("Request not found");
      return;
    }
    
    const request = requestSnap.data();
    
    // Handle different request types
    if (request.type === "sell") {
      // For sell requests, add component to stock
      if (!confirm("Approve this sell request and add component to inventory?")) return;
      
      const componentId = request.componentName.toLowerCase().replace(/\s+/g, "_");
      const price = parseFloat(prompt("Enter purchase price for this component:"));
      
      if (!price || price <= 0) {
        alert("Valid purchase price is required");
        return;
      }
      
      // Add/update component in components collection
      await setDoc(doc(db, "components", componentId), {
        name: request.componentName,
        category: "Purchased", // Default category for purchased items
        sale_price: price,
        rentable: true
      });
      
      // Add/update stock
      const stockSnap = await getDoc(doc(db, "stock", componentId));
      if (stockSnap.exists()) {
        // Update existing stock
        const currentStock = stockSnap.data();
        await updateDoc(doc(db, "stock", componentId), {
          total_qty: currentStock.total_qty + request.quantity,
          available_qty: currentStock.available_qty + request.quantity
        });
      } else {
        // Create new stock entry
        await setDoc(doc(db, "stock", componentId), {
          total_qty: request.quantity,
          available_qty: request.quantity
        });
      }
      
      alert(`Component "${request.componentName}" added to inventory with quantity ${request.quantity}`);
    } else if (request.type === "component") {
      // For component requests, just approve without adding to stock
      if (!confirm("Approve this component request?")) return;
      
      alert("Component request approved. Admin will review the component requirement.");
    } else {
      // For rental and other requests
      if (!confirm("Approve this request?")) return;
    }
    
    // Update request status
    await updateDoc(doc(db, collection_name, requestId), {
      status: "approved",
      approvedDate: new Date().toISOString()
    });
    
    alert("Request approved successfully!");
    loadComponentRequests();
  } catch (error) {
    console.error("Error approving request:", error);
    alert("Error approving request: " + error.message);
  }
};

window.rejectRequest = async function(requestId, source = "guest") {
  const reason = prompt("Enter reason for rejection (optional):");
  if (reason === null) return; // User cancelled
  
  try {
    const collection_name = source === "user" ? "user_requests" : "component_requests";
    await updateDoc(doc(db, collection_name, requestId), {
      status: "rejected",
      rejectedDate: new Date().toISOString(),
      rejectionReason: reason || "No reason provided"
    });
    
    alert("Request rejected successfully!");
    loadComponentRequests();
  } catch (error) {
    console.error("Error rejecting request:", error);
    alert("Error rejecting request: " + error.message);
  }
};

window.createRentalFromRequest = async function(requestId, source = "guest") {
  try {
    // Determine which collection to use
    const collection_name = source === "user" ? "user_requests" : "component_requests";
    
    // Get request details
    const requestSnap = await getDoc(doc(db, collection_name, requestId));
    if (!requestSnap.exists()) {
      alert("Request not found in " + collection_name);
      return;
    }
    
    const request = requestSnap.data();
    
    // Only allow rental creation for rental type requests
    if (request.type && request.type !== "rental") {
      alert("Only rental requests can be converted to rentals");
      return;
    }
    
    // Check stock availability for all items
    let stockIssues = [];
    for (const item of request.items) {
      const stockSnap = await getDoc(doc(db, "stock", item.id));
      if (stockSnap.exists()) {
        const stock = stockSnap.data();
        if (stock.available_qty < item.quantity) {
          stockIssues.push(`${item.name}: Requested ${item.quantity}, Available ${stock.available_qty}`);
        }
      } else {
        stockIssues.push(`${item.name}: No stock record found`);
      }
    }
    
    if (stockIssues.length > 0) {
      const proceed = confirm(`Stock availability issues:\n${stockIssues.join('\n')}\n\nDo you want to proceed anyway?`);
      if (!proceed) return;
    }
    
    // Generate rental ID
    const rentalId = "RENT_" + Date.now();
    const staffMember = prompt("Enter staff member name:");
    const position = prompt("Enter staff position:");
    
    if (!staffMember || !position) {
      alert("Staff information is required");
      return;
    }
    
    // Calculate pricing
    let totalCost, tax, grandTotal;
    if (source === "user") {
      // For user requests, use the pre-calculated totals
      totalCost = request.totalCost || 0;
      tax = request.tax || 0;
      
      grandTotal = request.grandTotal || 0;
    } else {
      // For guest requests, use estimated values
      totalCost = request.estimatedCost || 0;
      tax = request.estimatedTax || 0;
      grandTotal = request.estimatedTotal || 0;
    }
    
    // Calculate expected return date
    const rentDate = new Date();
    const expectedReturnDate = new Date(rentDate);
    expectedReturnDate.setMonth(expectedReturnDate.getMonth() + (request.duration || 1));
    
    // Create rental record
    const rentalData = {
      rentalId: rentalId,
      customerName: request.requesterName,
      customerContact: request.requesterContact,
      issuedBy: staffMember,
      position: position,
      items: request.items,
      duration: request.duration || 1,
      totalCost: totalCost,
      tax: tax,
      grandTotal: grandTotal,
      rentDate: rentDate.toISOString(),
      expectedReturnDate: expectedReturnDate.toISOString(),
      status: "active",
      actualReturnDate: null,
      createdFromRequest: requestId,
      source: source
    };
    
    await setDoc(doc(db, "rentals", rentalId), rentalData);
    
    // Update stock for each item
    for (const item of request.items) {
      const stockSnap = await getDoc(doc(db, "stock", item.id));
      if (stockSnap.exists()) {
        const currentStock = stockSnap.data();
        const newAvailable = Math.max(0, currentStock.available_qty - item.quantity);
        await updateDoc(doc(db, "stock", item.id), {
          available_qty: newAvailable
        });
      }
    }
    
    // Mark request as completed
    await updateDoc(doc(db, collection_name, requestId), {
      status: "completed",
      completedDate: new Date().toISOString(),
      rentalId: rentalId
    });
    
    // Generate and print invoice
    generateInvoice(rentalData);
    
    alert(`Rental created successfully! Rental ID: ${rentalId}`);
    loadComponentRequests();
    if (typeof loadActiveRentals === "function") {
      loadActiveRentals();
    }
    
  } catch (error) {
    console.error("Error creating rental from request:", error);
    alert("Error creating rental: " + error.message);
  }
};

window.generateRequestInvoice = async function(requestId, source = "guest") {
  try {
    const collection_name = source === "user" ? "user_requests" : "component_requests";
    const requestSnap = await getDoc(doc(db, collection_name, requestId));
    if (!requestSnap.exists()) {
      alert("Request not found");
      return;
    }
    
    const requestData = requestSnap.data();
    
    // Convert request data to invoice format
    let invoiceData;
    
    if (requestData.type === "rental") {
      // Rental request
      invoiceData = {
        rentalId: requestData.requestId,
        customerName: requestData.requesterName,
        customerContact: requestData.requesterContact,
        issuedBy: "System Generated",
        position: "Component Request",
        items: requestData.items || [],
        duration: requestData.duration || 1,
        totalCost: requestData.totalCost || requestData.estimatedCost || 0,
        tax: requestData.tax || requestData.estimatedTax || 0,
        grandTotal: requestData.grandTotal || requestData.estimatedTotal || 0,
        rentDate: requestData.requestDate,
        expectedReturnDate: requestData.expectedReturnDate,
        status: requestData.status
      };
    } else if (requestData.type === "component") {
      // Component request
      invoiceData = {
        rentalId: requestData.requestId,
        customerName: requestData.requesterName,
        customerContact: requestData.requesterContact,
        issuedBy: "System Generated",
        position: "New Component Request",
        items: [{
          name: requestData.componentName,
          quantity: 1,
          monthlyPrice: 0,
          totalPrice: 0
        }],
        duration: "N/A",
        totalCost: 0,
        tax: 0,
        grandTotal: 0,
        rentDate: requestData.requestDate,
        expectedReturnDate: "N/A",
        status: requestData.status,
        description: requestData.description,
        category: requestData.category,
        reason: requestData.reason
      };
    } else if (requestData.type === "sell") {
      // Sell request
      invoiceData = {
        rentalId: requestData.requestId,
        customerName: requestData.requesterName,
        customerContact: requestData.requesterContact,
        issuedBy: "System Generated",
        position: "Sell Request",
        items: [{
          name: requestData.componentName,
          quantity: requestData.quantity,
          monthlyPrice: 0,
          totalPrice: requestData.askingPrice || 0
        }],
        duration: "N/A",
        totalCost: requestData.askingPrice || 0,
        tax: 0,
        grandTotal: requestData.askingPrice || 0,
        rentDate: requestData.requestDate,
        expectedReturnDate: "N/A",
        status: requestData.status,
        condition: requestData.condition,
        description: requestData.description
      };
    } else {
      // Legacy guest request format
      invoiceData = {
        rentalId: requestData.requestId,
        customerName: requestData.requesterName,
        customerContact: requestData.requesterContact,
        issuedBy: "System Generated",
        position: "Component Request",
        items: requestData.items || [],
        duration: requestData.duration || 1,
        totalCost: requestData.estimatedCost || 0,
        tax: requestData.estimatedTax || 0,
        grandTotal: requestData.estimatedTotal || 0,
        rentDate: requestData.requestDate,
        expectedReturnDate: requestData.expectedReturnDate,
        status: requestData.status
      };
    }
    
    generateRequestInvoiceHTML(invoiceData);
  } catch (error) {
    console.error("Error generating request invoice:", error);
    alert("Error generating invoice: " + error.message);
  }
};

function generateRequestInvoiceHTML(requestData) {
  const invoiceWindow = window.open('', '_blank');
  
  const rentDate = new Date(requestData.rentDate);
  const formattedDate = rentDate.toLocaleDateString('en-IN');
  const formattedTime = rentDate.toLocaleTimeString('en-IN');
  
  const subtotal = requestData.totalCost || 0;
  const tax = requestData.tax || 0;
  const grandTotal = requestData.grandTotal || (subtotal + tax);
  const duration = requestData.duration || 1;
  
  const expectedReturnDate = requestData.expectedReturnDate 
    ? new Date(requestData.expectedReturnDate).toLocaleDateString('en-IN')
    : "Not specified";
  
  const statusText = requestData.status === "pending" ? "COMPONENT REQUEST ESTIMATE" : "COMPONENT REQUEST";
  
  const invoiceHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>ROBOCEK Component Request Invoice</title>
    <style>
        @page { size: A4; margin: 20mm; }
        body { font-family: Arial, sans-serif; font-size: 12px; line-height: 1.4; color: #333; margin: 0; padding: 0; }
        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
        .header h1 { margin: 0; font-size: 18px; font-weight: bold; }
        .company-info { margin: 10px 0; }
        .request-status { background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 10px; margin: 15px 0; text-align: center; font-weight: bold; color: #856404; }
        .invoice-details { display: flex; justify-content: space-between; margin-bottom: 20px; }
        .customer-info, .request-info { flex: 1; }
        .request-info { text-align: right; }
        .rental-duration { background-color: #f0f8ff; border: 1px solid #4682b4; border-radius: 5px; padding: 10px; margin: 15px 0; text-align: center; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { background-color: #f0f0f0; border: 1px solid #333; padding: 8px; text-align: left; font-weight: bold; }
        td { border: 1px solid #333; padding: 8px; }
        .text-right { text-align: right; }
        .totals { margin-top: 20px; }
        .totals table { width: 50%; margin-left: auto; }
        .totals th, .totals td { border: none; border-bottom: 1px solid #333; }
        .grand-total { font-weight: bold; border-top: 2px solid #333 !important; }
        .terms { font-size: 10px; margin-top: 20px; background-color: #f9f9f9; padding: 10px; border: 1px solid #ddd; }
        @media print { .no-print { display: none; } }
    </style>
</head>
<body>
    <div class="header">
        <h1>ROBOCEK GCEK ${statusText}</h1>
        <div class="company-info">
            <div><strong>ROBOCEK GCEK</strong></div>
            <div>Government College of Engineering Kannur</div>
            <div>Contact: robocek@gcek.ac.in</div>
        </div>
    </div>
    
    ${requestData.status === "pending" ? `
    <div class="request-status">
        THIS IS AN ESTIMATE - REQUEST PENDING APPROVAL
    </div>
    ` : ''}
    
    <div class="invoice-details">
        <div class="customer-info">
            <strong>Requester: ${requestData.customerName}</strong><br>
            Contact: ${requestData.customerContact}
        </div>
        <div class="request-info">
            <strong>Date:</strong> ${formattedDate} ${formattedTime}<br>
            <strong>Request ID:</strong> ${requestData.rentalId}<br>
            <strong>Status:</strong> ${requestData.status.toUpperCase()}<br>
        </div>
    </div>
    
    <div class="rental-duration">
        <strong>Requested Duration: ${duration} Month${duration > 1 ? 's' : ''}</strong><br>
        <strong>Expected Return Date: ${expectedReturnDate}</strong>
    </div>
    
    <div>
        <p><strong>Dear ${requestData.customerName},</strong></p>
        <p>This document serves as ${requestData.status === "pending" ? "an estimate for your component request" : "confirmation of your approved component request"} from ROBOCEK GCEK. The following components have been requested:</p>
    </div>
    
    <table>
        <thead>
            <tr>
                <th>Item</th>
                <th class="text-right">Qty</th>
                <th class="text-right">Monthly Rate (Rs)</th>
                <th class="text-right">Duration</th>
                <th class="text-right">Total (Rs)</th>
            </tr>
        </thead>
        <tbody>
            ${requestData.items.map(item => {
              const monthlyRate = item.monthlyPrice || item.baseRentPrice || Math.round(item.estimatedTotalPrice / (item.quantity * duration));
              const totalPrice = item.estimatedTotalPrice || (monthlyRate * item.quantity * duration);
              return `
                <tr>
                    <td>${item.name}</td>
                    <td class="text-right">${item.quantity}</td>
                    <td class="text-right">${monthlyRate.toFixed(2)}</td>
                    <td class="text-right">${duration} month${duration > 1 ? 's' : ''}</td>
                    <td class="text-right">${totalPrice.toFixed(2)}</td>
                </tr>
              `;
            }).join('')}
        </tbody>
    </table>
    
    <div class="totals">
        <table>
            <tr>
                <td><strong>${requestData.status === "pending" ? "Estimated " : ""}Subtotal (Rs):</strong></td>
                <td class="text-right">${subtotal.toFixed(2)}</td>
            </tr>
            <tr>
                <td><strong>${requestData.status === "pending" ? "Estimated " : ""}Tax (2%):</strong></td>
                <td class="text-right">${tax.toFixed(2)}</td>
            </tr>
            <tr class="grand-total">
                <td><strong>${requestData.status === "pending" ? "Estimated " : ""}Total (Rs):</strong></td>
                <td class="text-right"><strong>${grandTotal.toFixed(2)}</strong></td>
            </tr>
        </table>
    </div>
    
    <div class="terms">
        <strong>Note:</strong> ${requestData.status === "pending" ? 
          "This is an estimate based on your request. Final pricing and availability will be confirmed upon approval." : 
          "Please contact us to complete the rental process."
        }
        <br><br>
        <strong>Terms & Conditions:</strong>
        <ul style="margin: 5px 0; padding-left: 20px;">
            <li>${requestData.status === "pending" ? "Request subject to component availability and admin approval" : "Components must be returned by the expected return date"}</li>
            <li>Components must be returned in working condition</li>
            <li>Customer is responsible for any damage or loss</li>
            <li>Pricing may be subject to change based on final availability</li>
        </ul>
    </div>
    
    <div class="no-print" style="margin-top: 20px; text-align: center;">
        <button onclick="window.print()" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">
            Print Invoice
        </button>
        <button onclick="window.close()" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer; margin-left: 10px;">
            Close
        </button>
    </div>
</body>
</html>
  `;
  
  invoiceWindow.document.write(invoiceHTML);
  invoiceWindow.document.close();
  
  setTimeout(() => {
    invoiceWindow.print();
  }, 500);
}

window.filterRequests = function() {
  const searchTerm = document.getElementById("searchRequests").value.toLowerCase();
  const tableBody = document.getElementById("requestsTableBody");
  if (!tableBody) return;
  
  const rows = tableBody.getElementsByTagName("tr");
  
  for (let row of rows) {
    if (row.cells.length < 9) continue; // Skip header or empty rows
    
    const requestId = row.cells[0].textContent.toLowerCase();
    const requesterName = row.cells[1].textContent.toLowerCase();
    const requesterContact = row.cells[2].textContent.toLowerCase();
    
    if (requestId.includes(searchTerm) || requesterName.includes(searchTerm) || requesterContact.includes(searchTerm)) {
      row.style.display = "";
    } else {
      row.style.display = "none";
    }
  }
};
