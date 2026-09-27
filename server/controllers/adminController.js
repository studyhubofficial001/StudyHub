const Subject = require('../models/Subjects');

const getSubjects = async (req, res) => {
  try {
    const subjects = await Subject.find();
    res.status(200).json(subjects);
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const createSubject = async (req, res) => {
  try {
    const { name, year, category } = req.body;
    const createdBy = req.user._id; // Assuming the user is authenticated and their ID is available in req.user
    if(name.trim() === '' || year.trim() === '' || category.trim() === '') {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const newSubject = new Subject({
      name,
      year,
      category,
      createdBy,
    });
    let alreadyExists = await Subject.findOne({ name: name, year: year, category: category });
    if (alreadyExists) {
      return res.status(400).json({ message: 'Subject already exists' });
    }
    await newSubject.save();
    res.status(201).json(newSubject);
  } catch (error) {
    console.error('Error creating subject:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, year, category } = req.body;

    const updatedSubject = await Subject.findByIdAndUpdate(
      id,
      { name, year, category },
      { new: true }
    );

    if (!updatedSubject) {
      return res.status(404).json({ message: 'Subject not found' });
    }

    res.status(200).json(updatedSubject);
  } catch (error) {
    console.error('Error updating subject:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteSubject = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedSubject = await Subject.findByIdAndDelete(id);

    if (!deletedSubject) {
      return res.status(404).json({ message: 'Subject not found' });
    }

    res.status(200).json({ message: 'Subject deleted successfully' });
  } catch (error) {
    console.error('Error deleting subject:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
};