// User dashboard JavaScript
console.log("user-app.js loaded as module");

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import {
  getAuth,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  query,
  where
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

/* ---------- GLOBAL VARIABLES ---------- */
let userCart = [];
let currentUser = null;

/* ---------- HELPER FUNCTIONS ---------- */
function showMessage(elementId, message, type) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  element.innerText = message;
  element.style.color = type === "error" ? "#ff6b6b" : "#3fa66b";
  
  if (type === "success") {
    setTimeout(() => {
      element.innerText = "";
    }, 3000);
  }
}

/* ---------- AUTH ---------- */
window.logout = function () {
  signOut(auth).then(() => location.href = "index.html");
};

/* ---------- LOAD USER INFO ---------- */
async function loadUserInfo() {
  if (!currentUser) return;
  
  try {
    const userDoc = await getDoc(doc(db, "users", currentUser.uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      document.getElementById("welcomeUser").innerText = `Welcome, ${userData.name}!`;
      
      document.getElementById("userInfo").innerHTML = `
        <p><strong>Name:</strong> ${userData.name}</p>
        <p><strong>Email:</strong> ${userData.email}</p>
        <p><strong>Phone:</strong> ${userData.phone}</p>
        <p><strong>Member since:</strong> ${new Date(userData.createdAt).toLocaleDateString()}</p>
      `;
    }
  } catch (error) {
    console.error("Error loading user info:", error);
  }
}

/* ---------- LOAD CATEGORIES ---------- */
async function loadUserCategories() {
  const select = document.getElementById("userCategoryFilter");
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
    console.error("Error loading categories:", error);
  }
}

/* ---------- LOAD COMPONENTS ---------- */
window.loadUserComponents = async function() {
  const categorySelect = document.getElementById("userCategoryFilter");
  const componentsList = document.getElementById("userComponentsList");
  const componentsSection = document.getElementById("userComponentsSection");
  
  if (!categorySelect || !componentsList) return;
  
  const selectedCategory = categorySelect.value;
  
  if (!selectedCategory) {
    componentsSection.style.display = "none";
    return;
  }

  try {
    const snap = await getDocs(collection(db, "components"));
    componentsList.innerHTML = "";
    
    let hasComponents = false;
    
    for (const c of snap.docs) {
      const comp = c.data();
      
      if (comp.category !== selectedCategory || !comp.rentable) continue;

      // Get stock info
      const stockSnap = await getDoc(doc(db, "stock", c.id));
      const stock = stockSnap.exists() ? stockSnap.data() : { available_qty: 0 };
      
      if (stock.available_qty <= 0) continue;

      hasComponents = true;
      const baseRentPrice = Math.round(comp.sale_price * 0.1);

      const componentDiv = document.createElement("div");
      componentDiv.className = "component-item";
      componentDiv.innerHTML = `
        <div class="component-info">
          <div class="component-name">${comp.name}</div>
          <div class="component-details">
            Available: ${stock.available_qty} | Rent: ₹${baseRentPrice}/month
          </div>
        </div>
        <div class="component-actions">
          <input type="number" id="user_qty_${c.id}" class="quantity-input" min="1" max="${stock.available_qty}" value="1">
          <button onclick="addToUserCart('${c.id}')" class="secondary btn-small">Add to Cart</button>
        </div>
      `;
      
      componentsList.appendChild(componentDiv);
    }
    
    if (hasComponents) {
      componentsSection.style.display = "block";
    } else {
      componentsSection.style.display = "block";
      componentsList.innerHTML = `<div style="text-align: center; color: var(--muted); padding: 20px;">
        No components available in this category
      </div>`;
    }
  } catch (error) {
    console.error("Error loading components:", error);
    showMessage("userCartMsg", "Error loading components: " + error.message, "error");
  }
};

/* ---------- ADD TO CART ---------- */
window.addToUserCart = async function(componentId) {
  try {
    const qtyInput = document.getElementById(`user_qty_${componentId}`);
    const quantity = parseInt(qtyInput.value) || 1;
    
    const compSnap = await getDoc(doc(db, "components", componentId));
    const stockSnap = await getDoc(doc(db, "stock", componentId));
    
    if (!compSnap.exists()) {
      showMessage("userCartMsg", "Component not found", "error");
      return;
    }
    
    const comp = compSnap.data();
    const stock = stockSnap.exists() ? stockSnap.data() : { available_qty: 0 };
    
    if (quantity > stock.available_qty) {
      showMessage("userCartMsg", "Not enough quantity available", "error");
      return;
    }
    
    const existingIndex = userCart.findIndex(item => item.id === componentId);
    
    if (existingIndex >= 0) {
      const newQty = userCart[existingIndex].quantity + quantity;
      if (newQty > stock.available_qty) {
        showMessage("userCartMsg", "Total quantity exceeds available stock", "error");
        return;
      }
      userCart[existingIndex].quantity = newQty;
    } else {
      const baseRentPrice = Math.round(comp.sale_price * 0.1);
      userCart.push({
        id: componentId,
        name: comp.name,
        baseRentPrice: baseRentPrice,
        quantity: quantity,
        maxAvailable: stock.available_qty
      });
    }
    
    updateUserCartDisplay();
    showMessage("userCartMsg", "Item added to cart!", "success");
  } catch (error) {
    console.error("Error adding to cart:", error);
    showMessage("userCartMsg", "Error adding item to cart", "error");
  }
};

/* ---------- UPDATE CART DISPLAY ---------- */
function updateUserCartDisplay() {
  const cartDiv = document.getElementById("userCart");
  const cartSection = document.getElementById("userCartSection");
  const totalCostEl = document.getElementById("userTotalCost");
  const checkoutBtn = document.getElementById("checkoutBtn");
  const durationSelect = document.getElementById("userRentalDuration");
  
  if (userCart.length === 0) {
    cartSection.style.display = "none";
    return;
  }
  
  cartSection.style.display = "block";
  
  const selectedDuration = parseInt(durationSelect.value) || 1;
  
  let totalCost = 0;
  cartDiv.innerHTML = "";
  
  userCart.forEach((item, index) => {
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
      <button onclick="removeFromUserCart(${index})" class="secondary btn-small">Remove</button>
    `;
    
    cartDiv.appendChild(cartItemDiv);
  });
  
  if (selectedDuration === 0 || !selectedDuration) {
    totalCostEl.innerHTML = `<div style="color: var(--muted);">Select duration to see pricing</div>`;
    checkoutBtn.style.display = "none";
    return;
  }
  
  const tax = Math.round(totalCost * 0.02);
  const grandTotal = totalCost + tax;
  
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
  
  checkoutBtn.style.display = "block";
}

window.updateUserCartDisplay = updateUserCartDisplay;

window.removeFromUserCart = function(index) {
  userCart.splice(index, 1);
  updateUserCartDisplay();
};

/* ---------- CHECKOUT ---------- */
window.checkout = async function() {
  const durationSelect = document.getElementById("userRentalDuration");
  const duration = parseInt(durationSelect.value);
  
  if (!duration || duration <= 0) {
    showMessage("userCartMsg", "Please select a rental duration", "error");
    return;
  }
  
  if (userCart.length === 0) {
    showMessage("userCartMsg", "Cart is empty", "error");
    return;
  }
  
  if (!currentUser) {
    showMessage("userCartMsg", "Please log in to continue", "error");
    return;
  }

  try {
    const userDoc = await getDoc(doc(db, "users", currentUser.uid));
    if (!userDoc.exists()) {
      showMessage("userCartMsg", "User profile not found", "error");
      return;
    }
    
    const userData = userDoc.data();
    const requestId = "USER_REQ_" + Date.now();
    
    const totalCost = userCart.reduce((sum, item) => {
      return sum + (item.baseRentPrice * item.quantity * duration);
    }, 0);
    
    const tax = Math.round(totalCost * 0.02);
    const grandTotal = totalCost + tax;
    
    const requestDate = new Date();
    const expectedReturnDate = new Date(requestDate);
    expectedReturnDate.setMonth(expectedReturnDate.getMonth() + duration);
    
    const requestData = {
      requestId: requestId,
      userId: currentUser.uid,
      requesterName: userData.name,
      requesterContact: userData.phone,
      requesterEmail: userData.email,
      items: userCart.map(item => ({
        ...item,
        monthlyPrice: item.baseRentPrice,
        totalPrice: item.baseRentPrice * item.quantity * duration
      })),
      duration: duration,
      totalCost: totalCost,
      tax: tax,
      grandTotal: grandTotal,
      requestDate: requestDate.toISOString(),
      expectedReturnDate: expectedReturnDate.toISOString(),
      status: "pending",
      type: "rental",
      createdBy: "user_account"
    };
    
    await setDoc(doc(db, "user_requests", requestId), requestData);
    
    showMessage("userCartMsg", `Rental request submitted successfully! Request ID: ${requestId}. We will contact you soon.`, "success");
    
    userCart = [];
    document.getElementById("userRentalDuration").value = "";
    updateUserCartDisplay();
    loadUserRequests();
    
  } catch (error) {
    console.error("Error submitting request:", error);
    showMessage("userCartMsg", "Error submitting request: " + error.message, "error");
  }
};

/* ---------- COMPONENT REQUESTS ---------- */
window.submitComponentRequest = async function() {
  const name = document.getElementById("requestComponentName").value.trim();
  const description = document.getElementById("requestComponentDescription").value.trim();
  const category = document.getElementById("requestComponentCategory").value.trim();
  const reason = document.getElementById("requestComponentReason").value.trim();
  
  if (!name || !description || !category) {
    showMessage("componentRequestMsg", "Please fill in all required fields", "error");
    return;
  }

  if (!currentUser) {
    showMessage("componentRequestMsg", "Please log in to submit requests", "error");
    return;
  }

  try {
    const userDoc = await getDoc(doc(db, "users", currentUser.uid));
    if (!userDoc.exists()) {
      showMessage("componentRequestMsg", "User profile not found", "error");
      return;
    }
    
    const userData = userDoc.data();
    const requestId = "COMP_REQ_" + Date.now();
    
    const requestData = {
      requestId: requestId,
      userId: currentUser.uid,
      requesterName: userData.name,
      requesterContact: userData.phone,
      requesterEmail: userData.email,
      componentName: name,
      description: description,
      category: category,
      reason: reason,
      status: "pending",
      type: "component",
      requestDate: new Date().toISOString(),
      createdBy: "user_account"
    };
    
    await setDoc(doc(db, "user_requests", requestId), requestData);
    
    showMessage("componentRequestMsg", `Component request submitted! Request ID: ${requestId}`, "success");
    
    // Clear form
    document.getElementById("requestComponentName").value = "";
    document.getElementById("requestComponentDescription").value = "";
    document.getElementById("requestComponentCategory").value = "";
    document.getElementById("requestComponentReason").value = "";
    
    loadUserRequests();
  } catch (error) {
    console.error("Error submitting component request:", error);
    showMessage("componentRequestMsg", "Error submitting request: " + error.message, "error");
  }
};

/* ---------- SELL REQUESTS ---------- */
window.submitSellRequest = async function() {
  const name = document.getElementById("sellComponentName").value.trim();
  const condition = document.getElementById("sellComponentCondition").value.trim();
  const quantity = parseInt(document.getElementById("sellComponentQuantity").value) || 0;
  const price = parseFloat(document.getElementById("sellComponentPrice").value) || 0;
  const description = document.getElementById("sellComponentDescription").value.trim();
  
  if (!name || !condition || quantity <= 0 || price <= 0) {
    showMessage("sellRequestMsg", "Please fill in all required fields with valid values", "error");
    return;
  }

  if (!currentUser) {
    showMessage("sellRequestMsg", "Please log in to submit requests", "error");
    return;
  }

  try {
    const userDoc = await getDoc(doc(db, "users", currentUser.uid));
    if (!userDoc.exists()) {
      showMessage("sellRequestMsg", "User profile not found", "error");
      return;
    }
    
    const userData = userDoc.data();
    const requestId = "SELL_REQ_" + Date.now();
    
    const requestData = {
      requestId: requestId,
      userId: currentUser.uid,
      requesterName: userData.name,
      requesterContact: userData.phone,
      requesterEmail: userData.email,
      componentName: name,
      condition: condition,
      quantity: quantity,
      askingPrice: price,
      description: description,
      status: "pending",
      type: "sell",
      requestDate: new Date().toISOString(),
      createdBy: "user_account"
    };
    
    await setDoc(doc(db, "user_requests", requestId), requestData);
    
    showMessage("sellRequestMsg", `Sell request submitted! Request ID: ${requestId}`, "success");
    
    // Clear form
    document.getElementById("sellComponentName").value = "";
    document.getElementById("sellComponentCondition").value = "";
    document.getElementById("sellComponentQuantity").value = "";
    document.getElementById("sellComponentPrice").value = "";
    document.getElementById("sellComponentDescription").value = "";
    
    loadUserRequests();
  } catch (error) {
    console.error("Error submitting sell request:", error);
    showMessage("sellRequestMsg", "Error submitting request: " + error.message, "error");
  }
};

/* ---------- LOAD USER REQUESTS ---------- */
async function loadUserRequests() {
  if (!currentUser) return;
  
  const tableBody = document.getElementById("userRequestsTableBody");
  if (!tableBody) return;
  
  try {
    const q = query(collection(db, "user_requests"), where("userId", "==", currentUser.uid));
    const snap = await getDocs(q);
    
    tableBody.innerHTML = "";
    
    if (snap.empty) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" style="color: #9fbfb0; text-align: center;">
            No requests found
          </td>
        </tr>
      `;
      return;
    }
    
    const requests = [];
    snap.forEach(doc => {
      requests.push(doc.data());
    });
    
    requests.sort((a, b) => new Date(b.requestDate) - new Date(a.requestDate));
    
    requests.forEach(request => {
      const requestDate = new Date(request.requestDate).toLocaleDateString();
      let details = "";
      let total = "";
      
      if (request.type === "rental") {
        details = request.items.map(item => `${item.name} (${item.quantity})`).join(", ");
        total = `₹${request.grandTotal || 0}`;
      } else if (request.type === "component") {
        details = `${request.componentName} - ${request.description}`;
        total = "N/A";
      } else if (request.type === "sell") {
        details = `${request.componentName} (${request.quantity}) - ${request.condition}`;
        total = `₹${request.askingPrice}`;
      }
      
      let statusClass = "";
      let statusText = request.status || "pending";
      switch(statusText) {
        case "pending":
          statusClass = 'style="color: #ffa500;"';
          statusText = "Pending";
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
        <td>${request.type.charAt(0).toUpperCase() + request.type.slice(1)}</td>
        <td class="rental-items" title="${details}">${details}</td>
        <td ${statusClass}>${statusText}</td>
        <td>${requestDate}</td>
        <td>${total}</td>
      `;
      
      tableBody.appendChild(row);
    });
    
  } catch (error) {
    console.error("Error loading user requests:", error);
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" style="color: #ff6b6b; text-align: center;">
          Error loading requests
        </td>
      </tr>
    `;
  }
}

window.filterUserRequests = function() {
  const filter = document.getElementById("requestTypeFilter").value;
  const tableBody = document.getElementById("userRequestsTableBody");
  const rows = tableBody.getElementsByTagName("tr");
  
  for (let row of rows) {
    if (row.cells.length < 6) continue;
    
    const type = row.cells[1].textContent.toLowerCase();
    
    if (filter === "all" || type === filter) {
      row.style.display = "";
    } else {
      row.style.display = "none";
    }
  }
};

/* ---------- AUTH STATE ---------- */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    location.href = "index.html";
    return;
  }

  currentUser = user;
  
  // Check if this is a user (has profile) or admin (no profile)
  const userProfile = await getDoc(doc(db, "users", user.uid));
  if (!userProfile.exists()) {
    // No user profile means this is an admin account
    location.href = "dashboard.html";
    return;
  }
  
  // Load user data
  await loadUserInfo();
  await loadUserCategories();
  await loadUserRequests();
});
