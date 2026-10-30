// Request system JavaScript
console.log("request.js loaded as module");

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
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
const db = getFirestore(app);
console.log("Firebase initialized for request system");

/* ---------- GLOBAL VARIABLES ---------- */
let requestCart = [];

/* ---------- HELPER FUNCTIONS ---------- */
function showMessage(elementId, message, type) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  element.innerText = message;
  element.style.color = type === "error" ? "#ff6b6b" : "#3fa66b";
  
  // Clear message after 5 seconds for success messages
  if (type === "success") {
    setTimeout(() => {
      element.innerText = "";
    }, 5000);
  }
}

/* ---------- LOAD CATEGORIES FOR REQUESTS ---------- */
async function loadRequestCategories() {
  console.log("Loading request categories...");
  const select = document.getElementById("requestCategoryFilter");
  if (!select) {
    console.error("requestCategoryFilter element not found");
    return;
  }

  try {
    console.log("Fetching components from Firebase...");
    const snap = await getDocs(collection(db, "components"));
    const categories = new Set();
    
    console.log("Total components found:", snap.docs.length);

    snap.forEach(d => {
      const c = d.data();
      console.log("Component:", c.name, "Category:", c.category, "Rentable:", c.rentable);
      if (c.category && c.rentable) categories.add(c.category);
    });

    console.log("Categories found:", Array.from(categories));

    select.innerHTML = `<option value="">-- Select Category --</option>`;

    categories.forEach(cat => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.innerText = cat;
      select.appendChild(opt);
    });
    
    console.log("Categories loaded successfully");
  } catch (error) {
    console.error("Error loading request categories:", error);
  }
}

// Expose to global scope
window.loadRequestCategories = loadRequestCategories;

/* ---------- LOAD COMPONENTS FOR REQUESTS ---------- */
window.loadRequestComponents = async function() {
  const categorySelect = document.getElementById("requestCategoryFilter");
  const componentsList = document.getElementById("requestComponentsList");
  const componentsSection = document.getElementById("requestComponentsSection");
  
  if (!categorySelect || !componentsList) return;
  
  const selectedCategory = categorySelect.value;
  
  if (!selectedCategory) {
    componentsSection.style.display = "none";
    return;
  }

  try {
    console.log("Loading request components for category:", selectedCategory);
    const snap = await getDocs(collection(db, "components"));
    componentsList.innerHTML = "";
    
    let hasComponents = false;
    
    for (const c of snap.docs) {
      const comp = c.data();
      
      if (comp.category !== selectedCategory || !comp.rentable) continue;

      // For requests, we don't check actual stock - show all rentable components
      hasComponents = true;
      const baseRentPrice = Math.round(comp.sale_price * 0.1); // 10% of sale price per month

      const componentDiv = document.createElement("div");
      componentDiv.className = "component-item";
      componentDiv.innerHTML = `
        <div class="component-info">
          <div class="component-name">${comp.name}</div>
          <div class="component-details">
            Base Rent: ₹${baseRentPrice}/month/item
          </div>
        </div>
        <div class="component-actions">
          <input type="number" id="req_qty_${c.id}" class="quantity-input" min="1" max="99" value="1">
          <button onclick="addToRequestCart('${c.id}')" class="secondary btn-small">Add to Request</button>
        </div>
      `;
      
      componentsList.appendChild(componentDiv);
    }
    
    if (hasComponents) {
      componentsSection.style.display = "block";
    } else {
      componentsSection.style.display = "block";
      componentsList.innerHTML = `<div style="text-align: center; color: var(--muted); padding: 20px;">
        No rentable components available in this category
      </div>`;
    }
  } catch (error) {
    console.error("Error loading request components:", error);
    showMessage("requestMsg", "Error loading components: " + error.message, "error");
  }
};

/* ---------- ADD TO REQUEST CART ---------- */
window.addToRequestCart = async function(componentId) {
  try {
    const qtyInput = document.getElementById(`req_qty_${componentId}`);
    const quantity = parseInt(qtyInput.value) || 1;
    
    if (quantity <= 0 || quantity > 99) {
      showMessage("requestMsg", "Please enter a valid quantity (1-99)", "error");
      return;
    }
    
    // Get component details
    const compSnap = await getDoc(doc(db, "components", componentId));
    
    if (!compSnap.exists()) {
      showMessage("requestMsg", "Component not found", "error");
      return;
    }
    
    const comp = compSnap.data();
    
    // Check if item already in cart
    const existingIndex = requestCart.findIndex(item => item.id === componentId);
    
    if (existingIndex >= 0) {
      // Update existing item
      const newQty = requestCart[existingIndex].quantity + quantity;
      if (newQty > 99) {
        showMessage("requestMsg", "Maximum quantity per item is 99", "error");
        return;
      }
      requestCart[existingIndex].quantity = newQty;
    } else {
      // Add new item to cart
      const baseRentPrice = Math.round(comp.sale_price * 0.1);
      requestCart.push({
        id: componentId,
        name: comp.name,
        baseRentPrice: baseRentPrice,
        quantity: quantity
      });
    }
    
    updateRequestCartDisplay();
    showMessage("requestMsg", "Item added to request!", "success");
  } catch (error) {
    console.error("Error adding to request cart:", error);
    showMessage("requestMsg", "Error adding item to request", "error");
  }
};

/* ---------- UPDATE REQUEST CART DISPLAY ---------- */
function updateRequestCartDisplay() {
  const cartDiv = document.getElementById("requestCart");
  const cartSection = document.getElementById("requestCartSection");
  const totalCostEl = document.getElementById("requestTotalCost");
  const submitBtn = document.getElementById("submitRequestBtn");
  const durationSelect = document.getElementById("requestDuration");
  
  if (requestCart.length === 0) {
    cartSection.style.display = "none";
    submitBtn.style.display = "none";
    return;
  }
  
  cartSection.style.display = "block";
  submitBtn.style.display = "block";
  
  // Get selected duration
  const selectedDuration = parseInt(durationSelect.value) || 1;
  
  let totalCost = 0;
  cartDiv.innerHTML = "";
  
  requestCart.forEach((item, index) => {
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
      <button onclick="removeFromRequestCart(${index})" class="secondary btn-small">Remove</button>
    `;
    
    cartDiv.appendChild(cartItemDiv);
  });
  
  if (selectedDuration === 0 || !selectedDuration) {
    totalCostEl.innerHTML = `<div style="color: var(--muted);">Select duration to see estimated cost</div>`;
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
      <div style="margin-top: 8px;">Estimated Subtotal: ₹${totalCost}</div>
      <div>Estimated Tax (2%): ₹${tax}</div>
      <div style="font-size: 1.1em; margin-top: 5px; padding-top: 5px; border-top: 1px solid var(--green);">
        <strong>Estimated Total: ₹${grandTotal}</strong>
      </div>
      <div style="font-size: 0.85em; color: var(--muted); margin-top: 5px;">
        <em>*Actual pricing may vary based on availability</em>
      </div>
    </div>
  `;
}

window.updateRequestCartDisplay = updateRequestCartDisplay;

/* ---------- REMOVE FROM REQUEST CART ---------- */
window.removeFromRequestCart = function(index) {
  requestCart.splice(index, 1);
  updateRequestCartDisplay();
};

/* ---------- SUBMIT REQUEST ---------- */
window.submitRequest = async function() {
  const requesterName = document.getElementById("requesterName").value.trim();
  const requesterContact = document.getElementById("requesterContact").value.trim();
  const durationSelect = document.getElementById("requestDuration");
  const duration = parseInt(durationSelect.value);
  
  if (!requesterName || !requesterContact) {
    showMessage("requestMsg", "Please fill in your name and phone number", "error");
    return;
  }
  
  if (!duration || duration <= 0) {
    showMessage("requestMsg", "Please select a rental duration", "error");
    return;
  }
  
  if (requestCart.length === 0) {
    showMessage("requestMsg", "Please add at least one component to your request", "error");
    return;
  }
  
  // Validate phone number format (basic validation)
  const phoneRegex = /^[0-9+\-\s()]{10,15}$/;
  if (!phoneRegex.test(requesterContact)) {
    showMessage("requestMsg", "Please enter a valid phone number", "error");
    return;
  }
  
  try {
    // Generate request ID
    const requestId = "REQ_" + Date.now();
    
    // Calculate estimated cost based on duration
    const estimatedCost = requestCart.reduce((sum, item) => {
      return sum + (item.baseRentPrice * item.quantity * duration);
    }, 0);
    
    const estimatedTax = Math.round(estimatedCost * 0.02); // 2% tax
    const estimatedTotal = estimatedCost + estimatedTax;
    
    // Calculate expected return date
    const requestDate = new Date();
    const expectedReturnDate = new Date(requestDate);
    expectedReturnDate.setMonth(expectedReturnDate.getMonth() + duration);
    
    // Create request record
    const requestData = {
      requestId: requestId,
      requesterName: requesterName,
      requesterContact: requesterContact,
      items: requestCart.map(item => ({
        ...item,
        monthlyPrice: item.baseRentPrice,
        estimatedTotalPrice: item.baseRentPrice * item.quantity * duration
      })),
      duration: duration,
      estimatedCost: estimatedCost,
      estimatedTax: estimatedTax,
      estimatedTotal: estimatedTotal,
      requestDate: requestDate.toISOString(),
      expectedReturnDate: expectedReturnDate.toISOString(),
      status: "pending", // pending, approved, rejected, completed
      adminNotes: "",
      createdBy: "public_request"
    };
    
    await setDoc(doc(db, "component_requests", requestId), requestData);
    
    showMessage("requestMsg", `Request submitted successfully! Request ID: ${requestId}. We will contact you at ${requesterContact} for further processing.`, "success");
    
    // Clear form and cart
    document.getElementById("requesterName").value = "";
    document.getElementById("requesterContact").value = "";
    document.getElementById("requestDuration").value = "";
    document.getElementById("requestCategoryFilter").value = "";
    document.getElementById("requestComponentsSection").style.display = "none";
    requestCart = [];
    updateRequestCartDisplay();
    
    // Refresh the requests table if phone number is entered in search
    const searchInput = document.getElementById("searchOwnRequests");
    if (searchInput.value.trim()) {
      filterMyRequests();
    }
    
  } catch (error) {
    console.error("Error submitting request:", error);
    showMessage("requestMsg", "Error submitting request: " + error.message, "error");
  }
};

/* ---------- FILTER MY REQUESTS ---------- */
window.filterMyRequests = async function() {
  const searchTerm = document.getElementById("searchOwnRequests").value.trim();
  const tableBody = document.getElementById("myRequestsTableBody");
  
  if (!searchTerm) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" style="color: #9fbfb0; text-align: center;">
          Enter your phone number to view your requests
        </td>
      </tr>
    `;
    return;
  }
  
  try {
    const q = query(
      collection(db, "component_requests"), 
      where("requesterContact", "==", searchTerm)
    );
    const snap = await getDocs(q);
    
    tableBody.innerHTML = "";
    
    if (snap.empty) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="color: #9fbfb0; text-align: center;">
            No requests found for this phone number
          </td>
        </tr>
      `;
      return;
    }
    
    const requests = [];
    snap.forEach(doc => {
      requests.push(doc.data());
    });
    
    // Sort by request date (newest first)
    requests.sort((a, b) => new Date(b.requestDate) - new Date(a.requestDate));
    
    requests.forEach(request => {
      const requestDate = new Date(request.requestDate).toLocaleDateString();
      const itemsText = request.items.map(item => `${item.name} (${item.quantity})`).join(", ");
      const estimatedTotal = request.estimatedTotal || request.estimatedCost || 0;
      const duration = request.duration || "N/A";
      
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
        <td class="rental-items" title="${itemsText}">${itemsText}</td>
        <td>${duration} month${duration > 1 || duration === "N/A" ? 's' : ''}</td>
        <td>₹${estimatedTotal}</td>
        <td ${statusClass}>${statusText}</td>
        <td>${requestDate}</td>
      `;
      
      tableBody.appendChild(row);
    });
    
  } catch (error) {
    console.error("Error filtering requests:", error);
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" style="color: #ff6b6b; text-align: center;">
          Error loading requests
        </td>
      </tr>
    `;
  }
};

/* ---------- INITIALIZATION ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  console.log("DOM loaded, initializing request system...");
  try {
    await loadRequestCategories();
  } catch (error) {
    console.error("Error during initialization:", error);
  }
});

// Also try to load categories when the page is fully loaded
window.addEventListener('load', async () => {
  console.log("Page fully loaded, trying to load categories again...");
  try {
    await loadRequestCategories();
  } catch (error) {
    console.error("Error loading categories on window load:", error);
  }
});
