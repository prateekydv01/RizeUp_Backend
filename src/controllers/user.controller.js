import {User} from "../models/user.model.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {ApiError} from "../utils/ApiError.js"

const generateAccessAndRefreshToken  = async (userId)=>{
    try {
        const user = await User.findById(userId)
        if (!user){
            throw new ApiError(404, "No user found!");
        }
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        
        user.refreshToken = refreshToken
        await user.save({validateBeforeSave : false})
        return {accessToken,refreshToken}
    } catch (error) {
        throw new ApiError(500,"something went wrong while generating refresh token !")
    }
}

export const registerUser = asyncHandler(async(req,res)=>{
    const{fullName,username,email,password}=req.body;

    if (!username || !email || !password || !fullName) {
        throw new ApiError(400, "All fields are mandatory!");
    }


    const existingUser = await User.findOne({
            $or: [{ username: username.toLowerCase() }, { email }],
        });

    if(existingUser){
        throw new ApiError(409,"User with this email or username already exist!")
    }

    const user = await User.create({
        fullName,
        email,
        username: username.toLowerCase(),
        password,
    });

    if (!user) {
        throw new ApiError(500, "Something went wrong while registering the user!");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);

    const options = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
        }
    
    return res.status(201)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", refreshToken, options)
            .json(new ApiResponse(201, {
                user,
            }, "User registered successfully!"))
})

export const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, "Email and password are required!")
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    throw new ApiError(404, "User not found!")
  }

  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
     throw new ApiError(402, "Password incorrect!")
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);
  const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(new ApiResponse(200, {
      user: loggedInUser,
    }, "User logged in successfully"));
});

export const getCurrentUser = asyncHandler(async (req, res) => {
    return res.status(200).json(new ApiResponse(200, req.user, "Current user fetched successfully!"))
})

export const logoutUser = asyncHandler(async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
        user.refreshToken = undefined;
        await user.save({ validateBeforeSave: false });

        const options = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: 'strict'
        }

        return res
            .status(200)
            .clearCookie("accessToken", options)
            .clearCookie("refreshToken", options)
            .json(new ApiResponse(200, {}, "User logged out successfully!"))

    } catch (error) {
        console.error("Logout error:", error)
        throw new ApiError(500, "Something went wrong while logging out")
    }
})