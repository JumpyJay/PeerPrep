import Cookies from "js-cookie";

function handleLogout() {
  Cookies.remove("token");
  // ... any other logout logic
}

export { handleLogout };
