const User = require('../models/User');
const Subject = require('../models/Subjects');

const onboarding = async (req, res) => {
    const { year } = req.body;
    try {

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        if(user.isProfileComplete) {
            return res.status(400).json({ message: 'Onboarding already completed' });
        }
        if(user.verified === false) {
            return res.status(400).json({ message: 'Please verify your email before completing onboarding' });
        }
        if(year == null || year == undefined || year === '') {
            return res.status(400).json({ message: 'Year is required for onboarding' });
        }
        user.year = year;
        user.isProfileComplete = true;
        await user.save();

        return res.status(200).json({
            message: 'Onboarding completed successfully',
            user: {
                _id: user._id,
                name: user.username,
                email: user.email,
                role: user.role,
                year: user.year,
                isVerified: user.verified,
                isProfileComplete: user.isProfileComplete,
            },
        });
    } catch (error) {
        console.error('Error during onboarding:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getSubjectsByYear = async (req, res) => {
    const year = req.user.year;
    try {
        const subjects = await Subject.find({ year }).sort({ createdAt: -1 });
        res.status(200).json(subjects);
    } catch (error) {
        console.error('Error fetching subjects:', error);
        res.status(500).json({ message: 'Server error' });
    }
}; 

module.exports = {
    onboarding,
    getSubjectsByYear,
};