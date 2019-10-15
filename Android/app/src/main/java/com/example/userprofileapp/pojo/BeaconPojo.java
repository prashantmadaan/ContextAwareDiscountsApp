package com.example.userprofileapp.pojo;

import java.util.Date;

public class BeaconPojo {
   // String UUID;
    int major;
    int minor;
    long datetime;

    public BeaconPojo(int major, int minor, long datetime) {
        this.major = major;
        this.minor = minor;
        this.datetime = datetime;
    }

    public int getMajor() {
        return major;
    }

    public void setMajor(int major) {
        this.major = major;
    }

    public int getMinor() {
        return minor;
    }

    public void setMinor(int minor) {
        this.minor = minor;
    }

    public long getDatetime() {
        return datetime;
    }

    public void setDatetime(long datetime) {
        this.datetime = datetime;
    }
}
