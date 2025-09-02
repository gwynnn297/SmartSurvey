import axios from "axios";


const API_URL_LOGIN = 'https://www.apirequest.in/user/api/login';
const API_URL_REGISTER = 'https://www.apirequest.in/user/api';
export const register = async (fullName, email, password) => {
  try {
    console.log('Attempting register with:', { fullName, email, password });
    const response = await axios.post(API_URL_REGISTER, {
      name: fullName,
      email,
      password
    });
    console.log('Register response:', response.data);
    return response.data; // { msg: "user is created" }
  } catch (error) {
    console.error('Register error:', error.response?.data || error.message);
    throw error;
  }
};


export const login = async (email, password) => {
  try {
    console.log('Attempting login with:', { email, password });
    const response = await axios.post(API_URL_LOGIN, { email, password });
    console.log('Login response:', response.data);
    return response.data; // { token, user }
  } catch (error) {
    console.error('Login error:', error.response?.data || error.message);
    throw error;
  }
};

export const logout = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
};
