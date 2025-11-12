import Cookies from "js-cookie";

function handleLogout() {
  Cookies.remove("token");
  window.location.href = "/user";
}

export { handleLogout };
